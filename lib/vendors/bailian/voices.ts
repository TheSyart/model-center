import type { ProviderRow } from '../../services/provider.ts';
import { UpstreamError } from '../../upstream-error.ts';

/**
 * 百炼自定义音色（声音复刻 / 声音设计）。
 *
 * 上游是**两套 API 共用一个端点**，靠 `model` 字段区分，字段名与动作名全不一样。
 * 2026-09-20 用真实密钥逐条实测：
 *
 * | | `voice-enrollment` | `qwen-voice-enrollment` |
 * |---|---|---|
 * | 适用目标模型 | `cosyvoice-v3.x`、`qwen-audio-3.x-tts` | `qwen3-tts-vc/vd-*` |
 * | 创建 | `create_voice` + `prefix` + `url` | `create` + `preferred_name` + `audio.data` |
 * | 列举 | `list_voice` | `list` |
 * | 查询 | `query_voice` | —（列举里带状态） |
 * | 删除 | `delete_voice` + `voice_id` | `delete` + `voice` |
 * | 返回的 ID 字段 | `output.voice_id` | `output.voice` |
 *
 * 音频地址：`voice-enrollment` 只收公网 URL 或 `oss://`（后者要加
 * `X-DashScope-OssResourceResolve: enable`）；`qwen-voice-enrollment` 的
 * `audio.data` 公网 URL 与 base64 data URI 都收。
 *
 * **不落库。** 上游两套都支持分页列举，本地再存一份只会和上游漂移。
 * 代价是每次列举都要打一次上游，以及合成时不做「这个音色属于这个模型」的本地
 * 校验——那需要每次合成多一次 query_voice，不值得；改为把上游的拒绝翻译成提示。
 */

export type BailianVoiceApi = 'voice-enrollment' | 'qwen-voice-enrollment';

/**
 * 声音设计的缺省试听文本。
 *
 * 上游要求至少 15 个字符（短了回
 * `preview_text should not be shorter than 15 characters`），
 * 所以这里给一句足够长、内容中性的。
 */
export const DEFAULT_PREVIEW_TEXT = '你好，很高兴认识你，今天天气真不错，我们出去走走吧。';

export interface BailianVoice {
  id: string;
  targetModel?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  /** 声音设计会返回一段 base64 试听音频。 */
  preview?: { data: string; contentType: string } | null;
}

export interface BailianVoiceListPage {
  voices: BailianVoice[];
  pageIndex?: number;
  pageSize?: number;
  totalCount?: number;
  /** 上游还有没扫完的页；到达扫描上限时为 true。 */
  truncated?: boolean;
}

/**
 * 按 target_model 过滤时最多向上游翻多少页。
 *
 * 上游的 `list_voice` **没有按目标模型过滤的参数**——`prefix` 匹配的是创建时
 * 给的名字段，不是模型名（实测 `prefix="cosyvoice-v3-flash"` 返回 0 条，
 * 而 `prefix="bailian"` 命中了 id 里含 `-bailian-` 的那条）。所以只能取回来再筛，
 * 翻页得有个上限。每页 50，10 页覆盖 500 个音色；账号上限是每模型族 1000。
 */
const MAX_FILTER_PAGES = 10;
const FILTER_PAGE_SIZE = 50;

/**
 * 目标模型决定用哪套 API。
 *
 * `qwen3-tts-vc/vd-*` 走 qwen-voice-enrollment，其余（cosyvoice、qwen-audio-tts）
 * 走 voice-enrollment。传错的表现是 `Model not exist.` 或空的 400。
 */
export function voiceApiFor(targetModel: string): BailianVoiceApi {
  const bare = (targetModel.split('/').pop() ?? '').toLowerCase();
  return /^qwen3-tts-v[cd]\b|^qwen3-tts-v[cd]-/.test(bare) ? 'qwen-voice-enrollment' : 'voice-enrollment';
}

function host(workspaceId: string | null | undefined): string {
  const ws = workspaceId?.trim();
  return ws ? `https://${ws}.cn-beijing.maas.aliyuncs.com` : 'https://dashscope.aliyuncs.com';
}

export function bailianVoiceEndpoint(workspaceId: string | null | undefined): string {
  return `${host(workspaceId)}/api/v1/services/audio/tts/customization`;
}

async function callCustomization(
  provider: Pick<ProviderRow, 'workspaceId'>,
  apiKey: string,
  model: BailianVoiceApi,
  input: Record<string, unknown>,
  options: { parameters?: Record<string, unknown>; ossResource?: boolean; signal?: AbortSignal } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, any>> {
  const res = await fetchImpl(bailianVoiceEndpoint(provider.workspaceId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // 样本用 oss:// 地址时必须带，否则上游不会去解析它。
      ...(options.ossResource ? { 'X-DashScope-OssResourceResolve': 'enable' } : {}),
    },
    body: JSON.stringify({ model, input, ...(options.parameters ? { parameters: options.parameters } : {}) }),
    signal: options.signal,
  });

  const text = await res.text();
  let json: Record<string, any> = {};
  try {
    json = JSON.parse(text);
  } catch {
    // 下面按状态码处理。
  }
  if (!res.ok) {
    const detail = json.message ?? text.slice(0, 300);
    throw new UpstreamError(
      res.status,
      `百炼音色接口失败 (${res.status}): ${detail || '（上游返回了空的错误体）'}` +
        // workspace 专有域名会把错误体清空，这个坑在 ASR 上已经踩过一次。
        (detail ? '' : '。该服务商配置了 workspace 专有域名，上游在这条路上不返回错误详情。'),
    );
  }
  return json;
}

function normalize(raw: any, fallbackTarget?: string): BailianVoice {
  const previewData = raw?.preview_audio?.data;
  return {
    id: raw?.voice_id ?? raw?.voice ?? '',
    targetModel: raw?.target_model ?? fallbackTarget,
    status: raw?.status,
    createdAt: raw?.gmt_create,
    updatedAt: raw?.gmt_modified,
    preview: typeof previewData === 'string' && previewData.length > 0
      ? { data: previewData, contentType: 'audio/wav' }
      : null,
  };
}

export interface CreateVoiceOptions {
  targetModel: string;
  /** 音色名前缀 / 首选名。只允许小写字母与数字，上游对格式有要求。 */
  name: string;
  /** 复刻：样本音频地址（公网 URL、oss://，或 data URI——后者仅 qwen 那套支持）。 */
  audioUrl?: string;
  /** 设计：一句话描述音色。与 audioUrl 二选一。 */
  prompt?: string;
  /**
   * 设计时的试听文本。**上游要求 voice_prompt 与 preview_text 同时给**，
   * 只给描述会被回 `provide url, or provide both voice_prompt and preview_text`。
   * 调用方不给就用 DEFAULT_PREVIEW_TEXT。
   */
  previewText?: string;
  languageHints?: string[];
  signal?: AbortSignal;
}

export async function createBailianVoice(
  provider: Pick<ProviderRow, 'workspaceId'>,
  apiKey: string,
  options: CreateVoiceOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<BailianVoice> {
  const api = voiceApiFor(options.targetModel);
  const isDesign = !options.audioUrl && !!options.prompt;
  const ossResource = options.audioUrl?.startsWith('oss://') ?? false;

  if (api === 'qwen-voice-enrollment') {
    if (isDesign) {
      // 实测 2026-09-21：vd 系作为 target_model 会被上游回
      // `preprocess service not found for '…'`，与网关无关。
      throw new UpstreamError(
        400,
        `目标模型 "${options.targetModel}" 不能用于声音设计：上游对 vd 系返回 ` +
          '`preprocess service not found`，该能力在当前账号/地域未开通。' +
          '声音设计请把 model 指向 cosyvoice-v3.x 或 qwen-audio-3.x-tts 系列。',
      );
    }
    const json = await callCustomization(
      provider,
      apiKey,
      api,
      {
        action: 'create',
        target_model: options.targetModel,
        preferred_name: options.name,
        audio: { data: options.audioUrl },
        ...(options.languageHints?.length ? { language: options.languageHints[0] } : {}),
      },
      { signal: options.signal },
      fetchImpl,
    );
    return normalize(json.output, options.targetModel);
  }

  const json = await callCustomization(
    provider,
    apiKey,
    api,
    {
      action: 'create_voice',
      target_model: options.targetModel,
      prefix: options.name,
      ...(options.audioUrl ? { url: options.audioUrl } : {}),
      // voice_prompt 与 preview_text 是一对，上游缺一不可。
      ...(options.prompt
        ? { voice_prompt: options.prompt, preview_text: options.previewText || DEFAULT_PREVIEW_TEXT }
        : {}),
      ...(options.languageHints?.length ? { language_hints: options.languageHints } : {}),
    },
    {
      ossResource,
      ...(isDesign ? { parameters: { sample_rate: 24000, response_format: 'wav' } } : {}),
      signal: options.signal,
    },
    fetchImpl,
  );
  return normalize(json.output, options.targetModel);
}

async function listOnePage(
  provider: Pick<ProviderRow, 'workspaceId'>,
  apiKey: string,
  api: BailianVoiceApi,
  args: { prefix?: string; pageIndex: number; pageSize: number; signal?: AbortSignal },
  fetchImpl: typeof fetch,
): Promise<{ voices: BailianVoice[]; raw: Record<string, any> }> {
  const json = await callCustomization(
    provider,
    apiKey,
    api,
    {
      action: api === 'qwen-voice-enrollment' ? 'list' : 'list_voice',
      ...(args.prefix ? { prefix: args.prefix } : {}),
      page_index: args.pageIndex,
      page_size: args.pageSize,
    },
    { signal: args.signal },
    fetchImpl,
  );
  const out = json.output ?? {};
  const list = Array.isArray(out.voice_list) ? out.voice_list : [];
  return { voices: list.map((v: any) => normalize(v)), raw: out };
}

export async function listBailianVoices(
  provider: Pick<ProviderRow, 'workspaceId'>,
  apiKey: string,
  options: {
    targetModel: string;
    prefix?: string;
    pageIndex?: number;
    pageSize?: number;
    /** 关掉按目标模型的过滤，列出账号下这一套 API 的全部音色。 */
    includeAllModels?: boolean;
    signal?: AbortSignal;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<BailianVoiceListPage> {
  const api = voiceApiFor(options.targetModel);
  const pageIndex = options.pageIndex ?? 0;
  const pageSize = options.pageSize ?? 20;

  if (options.includeAllModels) {
    const { voices, raw } = await listOnePage(
      provider, apiKey, api,
      { prefix: options.prefix, pageIndex, pageSize, signal: options.signal },
      fetchImpl,
    );
    return { voices, pageIndex: raw.page_index, pageSize: raw.page_size, totalCount: raw.total_count };
  }

  /**
   * 上游不支持按 target_model 过滤，只能取回来自己筛。
   *
   * 不筛的后果不是「多几条」——调用方会拿到一批**绑在别的模型上、根本用不了**的
   * 音色，而且要到合成时才收到 400。所以宁可多翻几页。
   */
  const bare = options.targetModel.split('/').pop() ?? options.targetModel;
  const matched: BailianVoice[] = [];
  let truncated = false;

  for (let page = 0; page < MAX_FILTER_PAGES; page += 1) {
    const { voices } = await listOnePage(
      provider, apiKey, api,
      { prefix: options.prefix, pageIndex: page, pageSize: FILTER_PAGE_SIZE, signal: options.signal },
      fetchImpl,
    );
    for (const voice of voices) {
      // qwen-voice-enrollment 的列举不回 target_model，那一套本来就只服务 vc 一族。
      if (!voice.targetModel || voice.targetModel === bare) matched.push({ ...voice, targetModel: voice.targetModel ?? bare });
    }
    if (voices.length < FILTER_PAGE_SIZE) break;
    if (page === MAX_FILTER_PAGES - 1) truncated = true;
  }

  const start = pageIndex * pageSize;
  return {
    voices: matched.slice(start, start + pageSize),
    pageIndex,
    pageSize,
    // 过滤之后的条数，不是上游那个包含所有模型的总数。
    totalCount: matched.length,
    truncated,
  };
}

export async function getBailianVoice(
  provider: Pick<ProviderRow, 'workspaceId'>,
  apiKey: string,
  options: { targetModel: string; voiceId: string; signal?: AbortSignal },
  fetchImpl: typeof fetch = fetch,
): Promise<BailianVoice> {
  if (voiceApiFor(options.targetModel) === 'qwen-voice-enrollment') {
    // 这一套没有单条查询动作，从列举里挑。
    const page = await listBailianVoices(provider, apiKey, { targetModel: options.targetModel, pageSize: 100, signal: options.signal }, fetchImpl);
    const found = page.voices.find((v) => v.id === options.voiceId);
    if (!found) throw new UpstreamError(404, `音色 "${options.voiceId}" 不存在`);
    return found;
  }
  const json = await callCustomization(
    provider,
    apiKey,
    'voice-enrollment',
    { action: 'query_voice', voice_id: options.voiceId },
    { signal: options.signal },
    fetchImpl,
  );
  return { ...normalize(json.output, options.targetModel), id: options.voiceId };
}

export async function deleteBailianVoice(
  provider: Pick<ProviderRow, 'workspaceId'>,
  apiKey: string,
  options: { targetModel: string; voiceId: string; signal?: AbortSignal },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const api = voiceApiFor(options.targetModel);
  await callCustomization(
    provider,
    apiKey,
    api,
    api === 'qwen-voice-enrollment'
      ? { action: 'delete', voice: options.voiceId }
      : { action: 'delete_voice', voice_id: options.voiceId },
    { signal: options.signal },
    fetchImpl,
  );
}

/**
 * 把上传的样本音频交给百炼。
 *
 * `qwen-voice-enrollment` 的 `audio.data` 直接收 base64 data URI，不用上传。
 * `voice-enrollment` 只收地址，所以要先走一趟 OSS 直传策略换一个 `oss://` 地址。
 */
export function needsOssUpload(targetModel: string): boolean {
  return voiceApiFor(targetModel) === 'voice-enrollment';
}

export interface OssUploadPolicy {
  policy: string;
  signature: string;
  uploadDir: string;
  uploadHost: string;
  accessKeyId: string;
  xOssObjectAcl?: string;
  xOssForbidOverwrite?: string;
}

export async function getBailianUploadPolicy(
  provider: Pick<ProviderRow, 'workspaceId'>,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<OssUploadPolicy> {
  const url = `${host(provider.workspaceId)}/api/v1/uploads?action=getPolicy&model=${encodeURIComponent(model)}`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal });
  if (!res.ok) {
    throw new UpstreamError(res.status, `百炼上传策略获取失败 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as any;
  const d = json?.data;
  if (!d?.policy || !d?.upload_host) {
    throw new UpstreamError(502, `百炼上传策略响应缺字段：${JSON.stringify(json).slice(0, 200)}`);
  }
  return {
    policy: d.policy,
    signature: d.signature,
    uploadDir: d.upload_dir,
    uploadHost: d.upload_host,
    accessKeyId: d.oss_access_key_id,
    xOssObjectAcl: d.x_oss_object_acl,
    xOssForbidOverwrite: d.x_oss_forbid_overwrite,
  };
}

/** 表单直传，返回 `oss://` 地址（实测 48 小时有效）。 */
export async function uploadBailianSample(
  policy: OssUploadPolicy,
  file: Blob,
  fileName: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const key = `${policy.uploadDir}/${fileName}`;
  const form = new FormData();
  form.append('OSSAccessKeyId', policy.accessKeyId);
  form.append('Signature', policy.signature);
  form.append('policy', policy.policy);
  form.append('key', key);
  if (policy.xOssObjectAcl) form.append('x-oss-object-acl', policy.xOssObjectAcl);
  if (policy.xOssForbidOverwrite) form.append('x-oss-forbid-overwrite', policy.xOssForbidOverwrite);
  form.append('success_action_status', '200');
  form.append('file', file, fileName);

  const res = await fetchImpl(policy.uploadHost, { method: 'POST', body: form, signal });
  if (!res.ok) {
    throw new UpstreamError(res.status, `样本音频上传失败 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return `oss://${key}`;
}
