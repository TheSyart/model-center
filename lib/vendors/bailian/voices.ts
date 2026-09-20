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
}

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
  /** 设计时的试听文本。 */
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
      throw new UpstreamError(400, `目标模型 "${options.targetModel}" 的声音设计需要 qwen3-voice-design 服务，本网关未代理。`);
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
      ...(options.prompt ? { voice_prompt: options.prompt } : {}),
      ...(options.previewText ? { preview_text: options.previewText } : {}),
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

export async function listBailianVoices(
  provider: Pick<ProviderRow, 'workspaceId'>,
  apiKey: string,
  options: { targetModel: string; prefix?: string; pageIndex?: number; pageSize?: number; signal?: AbortSignal },
  fetchImpl: typeof fetch = fetch,
): Promise<BailianVoiceListPage> {
  const api = voiceApiFor(options.targetModel);
  const json = await callCustomization(
    provider,
    apiKey,
    api,
    {
      action: api === 'qwen-voice-enrollment' ? 'list' : 'list_voice',
      ...(options.prefix ? { prefix: options.prefix } : {}),
      page_index: options.pageIndex ?? 0,
      page_size: options.pageSize ?? 20,
    },
    { signal: options.signal },
    fetchImpl,
  );
  const out = json.output ?? {};
  const list = Array.isArray(out.voice_list) ? out.voice_list : [];
  return {
    voices: list.map((v: any) => normalize(v)),
    pageIndex: out.page_index,
    pageSize: out.page_size,
    totalCount: out.total_count,
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
