import { isOfficialBailianCatalogProvider, normalizeBailianWorkspaceId } from './catalog.ts';
import type { ProviderRow } from '../../services/provider.ts';
import { UpstreamError } from '../../upstream-error.ts';
import { synthesizeOverWebSocket, ttsFailureHint } from './tts-websocket.ts';

/**
 * 百炼语音接口。
 *
 * 契约于 2026-09-20 用真实密钥逐族实测（workspace llm-a5kyboh5x4q9inqe），
 * 逐条结论记在 docs/vendor-apis/bailian.md。两条最容易踩的：
 *
 *  - **端点按模型族分，不能混用。** 打错端点上游回 `url error, please check url`。
 *    Qwen-TTS 与 ASR 都在多模态生成端点上，CosyVoice / Sambert 才在 SpeechSynthesizer。
 *  - **音色不通用。** 给 Qwen-TTS 传 CosyVoice 的 `longxiaochun_v3` 会被拒
 *    （`Invalid voice specified`）。
 *
 * 上游用 `current user api does not support http call` 表示「该模型只有 WebSocket」。
 */

export function isBailianAsrModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (
    lower.includes('asr') ||
    lower.includes('fun-asr') ||
    lower.includes('sensevoice') ||
    lower.includes('funasr')
  );
}

export function isBailianTtsModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (
    lower.includes('tts') ||
    lower.includes('cosyvoice') ||
    lower.includes('sambert')
  );
}

/**
 * 语音模型分四族，端点、协议、请求体各不相同，且没有交集——
 * 把 qwen3-tts-flash 发去 WebSocket 会得到 `Model not found`，
 * 把 sambert 发去 HTTP 会得到 `does not support http call`。
 */
export type BailianAudioKind =
  /** qwen-tts / qwen3-tts-*：HTTP 多模态生成端点。WebSocket 上查无此模型。 */
  | 'qwen-tts'
  /** sambert / cosyvoice / qwen-audio-*-tts：只能 WebSocket，HTTP 端点会拒。 */
  | 'ws-tts'
  /** 同步语音识别：HTTP 多模态生成端点。 */
  | 'asr'
  /** 录音文件转写：HTTP 异步提交 + 轮询。 */
  | 'asr-filetrans';

export type BailianAudioRoute =
  | { supported: true; kind: BailianAudioKind }
  | { supported: false; reason: string };

export function resolveBailianAudioRoute(modelId: string): BailianAudioRoute {
  const lower = modelId.toLowerCase();

  // 实测：qwen3-tts-flash-realtime 回 `current user api does not support http call`。
  // 实时模型本就是流式协议，HTTP 一问一答这条路给不了，先挡在本地而不是白跑一趟上游。
  if (lower.includes('realtime')) {
    return { supported: false, reason: '实时语音模型只提供 WebSocket 接口，网关的 HTTP 面无法承载' };
  }

  if (lower.includes('filetrans')) return { supported: true, kind: 'asr-filetrans' };
  if (isBailianAsrModel(modelId)) return { supported: true, kind: 'asr' };

  // 这三族只有 WebSocket。qwen-audio-*-tts 的名字里同时有 audio 和 tts，
  // 判定顺序要放在 asr 之后（qwen-audio-*-asr-* 已经被上一行接走）。
  if (lower.includes('cosyvoice') || lower.includes('sambert') ||
      (lower.includes('qwen-audio') && lower.includes('tts'))) {
    return { supported: true, kind: 'ws-tts' };
  }
  if (isBailianTtsModel(modelId)) return { supported: true, kind: 'qwen-tts' };

  return { supported: false, reason: '不是百炼语音模型' };
}

/** 准入判定：服务商必须是百炼官方目录，且模型确实能走 HTTP。 */
export function acceptsBailianAsr(target: { provider: ProviderRow; modelId: string }): boolean {
  const route = resolveBailianAudioRoute(target.modelId);
  return (
    isOfficialBailianCatalogProvider(target.provider) &&
    route.supported &&
    (route.kind === 'asr' || route.kind === 'asr-filetrans')
  );
}

export function acceptsBailianTts(target: { provider: ProviderRow; modelId: string }): boolean {
  const route = resolveBailianAudioRoute(target.modelId);
  return (
    isOfficialBailianCatalogProvider(target.provider) &&
    route.supported &&
    (route.kind === 'qwen-tts' || route.kind === 'ws-tts')
  );
}

/** 多模态生成端点同时服务 Qwen-TTS 与 ASR，原生透传面按端点而不是按 ASR/TTS 判定。 */
export function acceptsBailianMultimodalAudio(target: { provider: ProviderRow; modelId: string }): boolean {
  const route = resolveBailianAudioRoute(target.modelId);
  return (
    isOfficialBailianCatalogProvider(target.provider) &&
    route.supported &&
    (route.kind === 'asr' || route.kind === 'qwen-tts')
  );
}

export function acceptsBailianSpeechSynthesizer(target: { provider: ProviderRow; modelId: string }): boolean {
  const route = resolveBailianAudioRoute(target.modelId);
  return isOfficialBailianCatalogProvider(target.provider) && route.supported && route.kind === 'ws-tts';
}

/** 被拒时给客户端的说明：说清是服务商不对，还是这个模型走不了 HTTP。 */
export function bailianAudioRejectMessage(
  kind: 'ASR' | 'TTS',
  modelId: string,
  provider: ProviderRow,
): string {
  if (!isOfficialBailianCatalogProvider(provider)) {
    return `模型 "${modelId}"（服务商 ${provider.slug}）不在百炼官方目录下；该接口只转发百炼 DashScope，不会把其它服务商的凭据发往阿里云。`;
  }
  const route = resolveBailianAudioRoute(modelId);
  if (!route.supported) return `模型 "${modelId}" 不可用：${route.reason}。`;
  return `模型 "${modelId}" 不是${kind === 'ASR' ? '语音识别' : '语音合成'}模型，不能走这个接口。`;
}

function bailianHost(workspaceId?: string | null): string {
  const ws = normalizeBailianWorkspaceId(workspaceId);
  return ws ? `https://${ws}.cn-beijing.maas.aliyuncs.com` : 'https://dashscope.aliyuncs.com';
}

/** 多模态生成端点：Qwen-TTS 与同步 ASR 都在这里。 */
export function getBailianMultimodalEndpoint(workspaceId?: string | null): string {
  return `${bailianHost(workspaceId)}/api/v1/services/aigc/multimodal-generation/generation`;
}

/** SpeechSynthesizer 端点：CosyVoice 与 Sambert。 */
export function getBailianSpeechSynthesizerEndpoint(workspaceId?: string | null): string {
  return `${bailianHost(workspaceId)}/api/v1/services/audio/tts/SpeechSynthesizer`;
}

/** @deprecated 名字会误导——ASR 与 Qwen-TTS 共用这个端点。用 getBailianMultimodalEndpoint。 */
export const getBailianAsrEndpoint = getBailianMultimodalEndpoint;
/** @deprecated 只适用于 CosyVoice / Sambert。用 getBailianSpeechSynthesizerEndpoint。 */
export const getBailianTtsEndpoint = getBailianSpeechSynthesizerEndpoint;

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-DashScope-SSE': 'disable',
  };
}

async function post(
  url: string,
  apiKey: string,
  body: unknown,
  kind: string,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch,
): Promise<Record<string, any>> {
  const res = await fetchImpl(url, { method: 'POST', headers: headers(apiKey), body: JSON.stringify(body), signal });
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300);
    // 带上上游状态码：客户端请求写错了就该收到 4xx，不能一律兜成网关 500。
    throw new UpstreamError(res.status, `百炼 ${kind} 失败 (${res.status}): ${errText}`);
  }
  return (await res.json()) as Record<string, any>;
}

// ---------- ASR ----------

/**
 * ASR 分两套参数体系，**不能混用**（2026-09-20 实测）：
 *
 *  - `qwen3-asr-*`：`parameters.asr_options`，**不支持热词**。官方规格表里这一族
 *    「热词」就是否。实测把 `vocabulary` 传给它不报错、也不生效。
 *  - 其余（`qwen-audio-3.x-asr-*`、`fun-asr`、`paraformer`、`sensevoice`）：
 *    `parameters.vocabulary`（词→权重）且 **`parameters.format` 是必填的**。
 *
 * 少了 `format` 的后果极具迷惑性：workspace 专有域名返回**空的** `400 {}`，
 * 公共域名才会说出真正的原因 `UNSUPPORTED_FORMAT format is empty`。
 */
export type BailianAsrFamily = 'qwen3' | 'vocabulary';

export function bailianAsrFamily(modelId: string): BailianAsrFamily {
  // 路由层拿到的是 `bailian/qwen3-asr-flash` 这种带服务商前缀的名字，
  // 厂商层拿到的是解析后的裸模型名。两边都会调这个函数，所以先剥前缀。
  const bare = modelId.toLowerCase().split('/').pop() ?? '';
  return bare.startsWith('qwen3-') ? 'qwen3' : 'vocabulary';
}

export function supportsBailianVocabulary(modelId: string): boolean {
  return bailianAsrFamily(modelId) === 'vocabulary';
}

/**
 * 从 MIME 类型或文件名推断上游要的容器格式串。
 *
 * 只认上游支持的那几个；认不出来就返回 undefined，由调用方决定缺省——
 * 编一个上游不认识的格式串比给缺省值更糟。
 */
export function audioFormatFromName(mime: string | undefined, fileName?: string): string | undefined {
  const probe = `${mime ?? ''} ${fileName ?? ''}`.toLowerCase();
  const table: Array<[RegExp, string]> = [
    [/\bwav\b|x-wav|wave/, 'wav'],
    [/mpeg|\bmp3\b/, 'mp3'],
    [/\bm4a\b|mp4a/, 'm4a'],
    [/\baac\b/, 'aac'],
    [/\bogg\b/, 'ogg'],
    [/\bopus\b/, 'opus'],
    [/\bflac\b/, 'flac'],
    [/\bamr\b/, 'amr'],
    [/\bwebm\b/, 'webm'],
    [/\bpcm\b|audio\/l16/, 'pcm'],
  ];
  for (const [pattern, format] of table) {
    if (pattern.test(probe)) return format;
  }
  return undefined;
}

export interface BailianAsrOptions {
  model: string;
  /** base64 data URI 或公网可访问的 URL，两者实测都可用。 */
  audioDataUriOrUrl: string;
  languageHints?: string[];
  /**
   * 上下文消息。角色必须是 `system`——`user` 会被上游拒：
   * `The dedicated task 'asr' corresponding to the current service does not support this input.`
   */
  contextMessages?: Array<{ role: 'system'; text: string }>;
  /** 热词：词 → 权重（1-5，50 为超权重）。只有 vocabulary 族认。 */
  vocabulary?: Record<string, number>;
  /** 预先在控制台建好的热词表 ID。同样只有 vocabulary 族认。 */
  vocabularyId?: string;
  /** 音频容器格式（wav/mp3/…）。vocabulary 族**必填**，见上面的注释。 */
  format?: string;
  sampleRate?: number;
  /** 客户端断连与超时；不传就既不会中止也没有上限。 */
  signal?: AbortSignal;
}

/** 请求体的 `parameters`。抽成纯函数是为了能直接断言两族的差异。 */
export function buildBailianAsrParameters(options: BailianAsrOptions): Record<string, unknown> {
  if (bailianAsrFamily(options.model) === 'qwen3') {
    const asrOptions: Record<string, unknown> = { enable_lid: true };
    if (options.languageHints?.length) asrOptions.language = options.languageHints[0];
    return { asr_options: asrOptions };
  }
  return {
    // 缺省 wav：客户端没说格式时，multipart 上传的绝大多数是 wav，
    // 而**不传这个键一定失败**，所以宁可给个缺省也不能省略。
    format: options.format ?? 'wav',
    ...(options.sampleRate ? { sample_rate: options.sampleRate } : {}),
    ...(options.vocabulary ? { vocabulary: options.vocabulary } : {}),
    ...(options.vocabularyId ? { vocabulary_id: options.vocabularyId } : {}),
    ...(options.languageHints?.length ? { language_hints: options.languageHints } : {}),
  };
}

/** 上游的识别结果有三种形状，逐个兜。 */
export function extractBailianAsrText(json: Record<string, any>): string {
  const content = json.output?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map((part: any) => (typeof part?.text === 'string' ? part.text : '')).join('');
  }
  if (typeof content === 'string') return content;
  if (typeof json.output?.sentence?.text === 'string') return json.output.sentence.text;
  if (typeof json.output?.text === 'string') return json.output.text;
  return '';
}

export interface BailianAsrResponse {
  text: string;
  /** 上游报告的音频秒数（ASR 按秒计价，不是按 token）。 */
  seconds?: number;
  requestId?: string;
  raw: unknown;
}

/**
 * 同步语音识别。
 *
 * 请求体是 `input.messages[].content[].audio`——**不是** OpenAI 的
 * `{type:'input_audio', input_audio:{data}}`。后者发到这个端点会被拒：
 * `Input should be a valid string: input.messages.0.content.str`。
 * 那个形状属于 /compatible-mode/v1/chat/completions，两边别混。
 *
 * `parameters` 由 buildBailianAsrParameters 按模型族生成，且**永远要发**。
 */
export async function callBailianAsr(
  provider: ProviderRow,
  apiKey: string,
  options: BailianAsrOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<BailianAsrResponse> {
  const messages: unknown[] = [];
  for (const msg of options.contextMessages ?? []) {
    messages.push({ role: msg.role, content: [{ text: msg.text }] });
  }
  messages.push({ role: 'user', content: [{ audio: options.audioDataUriOrUrl }] });

  // parameters 永远要发：vocabulary 族少了它就是那个空的 400。
  const body: Record<string, unknown> = {
    model: options.model,
    input: { messages },
    parameters: buildBailianAsrParameters(options),
  };

  const json = await post(
    getBailianMultimodalEndpoint(provider.workspaceId),
    apiKey,
    body,
    'ASR',
    options.signal,
    fetchImpl,
  );

  return { text: extractBailianAsrText(json), seconds: json.usage?.seconds, requestId: json.request_id, raw: json };
}

// ---------- TTS ----------

export interface BailianTtsOptions {
  model: string;
  text: string;
  voice?: string;
  format?: 'wav' | 'mp3' | 'pcm' | 'opus';
  sampleRate?: number;
  /** Qwen-TTS 专用：如 Chinese / English。 */
  languageType?: string;
  /** WebSocket 连接注入，测试用。 */
  connect?: (url: string, apiKey: string) => import('./tts-websocket.ts').WebSocketLike;
  volume?: number;
  rate?: number;
  pitch?: number;
  signal?: AbortSignal;
}

export interface BailianTtsResponse {
  audioUrl?: string;
  audioBuffer?: Buffer;
  /**
   * 音频的真实类型，取自下载响应头或 URL 后缀。
   *
   * 不能照抄客户端请求的 response_format：Qwen-TTS 的请求体根本不收 format，
   * 实测固定返回 WAV，跟着客户端说的走会给出一个错的 Content-Type。
   */
  contentType?: string;
  /** 上游报告的字符数（TTS 按万字符计价，不是按 token）。 */
  characters?: number;
  requestId?: string;
  raw: unknown;
}

const URL_CONTENT_TYPES: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  opus: 'audio/opus',
  pcm: 'audio/L16',
};

/** WebSocket 直接给字节，没有 URL 可推断类型，按请求的格式定。 */
const WS_CONTENT_TYPES: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  pcm: 'audio/L16',
};

function contentTypeFromUrl(url: string): string | undefined {
  const ext = new URL(url).pathname.split('.').pop()?.toLowerCase();
  return ext ? URL_CONTENT_TYPES[ext] : undefined;
}

/**
 * 音色默认值。
 *
 * **音色表按模型版本分，串了会被拒**——上游用 `Engine return error code: 418`
 * 表示「这个音色不属于这个模型」。实测：cosyvoice-v2 只认 `*_v2`，
 * cosyvoice-v3-flash 认 `longanhuan` 这类无后缀名，两边互换都 418。
 *
 * Sambert 没有 voice 参数（模型名本身就是音色），所以不在表里。
 */
function defaultVoiceFor(modelId: string): string | undefined {
  const lower = modelId.toLowerCase();
  if (lower.startsWith('sambert')) return undefined;
  if (lower.startsWith('cosyvoice')) {
    // v1/v2 用带 _v2 后缀的一套，v3 之后用无后缀的一套。
    return /cosyvoice-v[12]\b/.test(lower) ? 'longxiaochun_v2' : 'longanhuan';
  }
  // qwen-audio-*-tts 只认 longanlingxi：2026-09-20 拿 20 个候选音色逐个实打，
  // 3.0-flash 与 3.0-plus 只有它不被 411 拒，连「不传 voice」都会被拒。
  if (lower.includes('qwen-audio')) return 'longanlingxi';
  return 'Cherry';
}

export async function callBailianTts(
  provider: ProviderRow,
  apiKey: string,
  options: BailianTtsOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<BailianTtsResponse> {
  const route = resolveBailianAudioRoute(options.model);
  if (!route.supported) throw new UpstreamError(400, `模型 "${options.model}" 不可用：${route.reason}`);
  const voice = options.voice ?? defaultVoiceFor(options.model);

  // 只能走 WebSocket 的三族：直接拿到音频字节，没有中间的下载 URL。
  if (route.kind === 'ws-tts') {
    const result = await synthesizeOverWebSocket(provider.workspaceId, apiKey, {
      model: options.model,
      text: options.text,
      voice,
      format: options.format === 'opus' ? 'mp3' : options.format,
      sampleRate: options.sampleRate,
      volume: options.volume,
      rate: options.rate,
      pitch: options.pitch,
      signal: options.signal,
      connect: options.connect,
    });
    return {
      audioBuffer: result.audio,
      contentType: WS_CONTENT_TYPES[options.format === 'opus' ? 'mp3' : (options.format ?? 'mp3')],
      characters: result.characters,
      requestId: result.requestId,
      raw: { via: 'websocket', bytes: result.audio.length },
    };
  }

  let json: Record<string, any>;
  try {
    json = await post(
      getBailianMultimodalEndpoint(provider.workspaceId),
      apiKey,
      {
        model: options.model,
        input: {
          text: options.text,
          voice,
          ...(options.languageType ? { language_type: options.languageType } : {}),
        },
      },
      'TTS',
      options.signal,
      fetchImpl,
    );
  } catch (e) {
    // qwen3-tts-vc / -vd 走的是 HTTP，它们「需要自建音色」的提示也要在这条路上给出。
    if (e instanceof UpstreamError) {
      const hint = ttsFailureHint(options.model, voice, e.message);
      if (hint) throw new UpstreamError(e.status, `${e.message}${hint}`);
    }
    throw e;
  }
  const audioUrl = json.output?.audio?.url;
  const characters = json.usage?.characters;

  let audioBuffer: Buffer | undefined;
  let contentType: string | undefined;
  if (audioUrl) {
    const audioRes = await fetchImpl(audioUrl, { signal: options.signal });
    if (audioRes.ok) {
      audioBuffer = Buffer.from(await audioRes.arrayBuffer());
      contentType = audioRes.headers.get('content-type') ?? contentTypeFromUrl(audioUrl);
    }
  }

  return { audioUrl, audioBuffer, contentType, characters, requestId: json.request_id, raw: json };
}

// ---------- 对话入口的语音兼容 ----------

/**
 * 从 Chat Completions 请求里认出语音调用并代为处理。
 * 既不是 ASR 也不是 TTS 模型时返回 null，交回普通对话链路。
 */
export async function tryHandleBailianSpecialChat(
  provider: ProviderRow,
  apiKey: string,
  modelId: string,
  rawBody: Record<string, any>,
  signal?: AbortSignal,
): Promise<{ text: string; seconds?: number; characters?: number } | null> {
  const route = resolveBailianAudioRoute(modelId);
  if (!route.supported) {
    // 名字像语音模型但 HTTP 走不通时，给出原因而不是丢回对话链路让它报一个更难懂的错。
    if (isBailianAsrModel(modelId) || isBailianTtsModel(modelId)) {
      throw new UpstreamError(400, `模型 "${modelId}" 不可用：${route.reason}`);
    }
    return null;
  }

  const messages = Array.isArray(rawBody.messages) ? rawBody.messages : [];

  // 录音文件转写只收公网 URL，对话入口拿不到可靠的 URL，明确拒绝而不是硬凑。
  if (route.kind === 'asr-filetrans') {
    throw new UpstreamError(
      400,
      `模型 "${modelId}" 是录音文件转写模型，只接受公网可访问的音频 URL；请改用 POST /v1/audio/transcriptions 并传 file_url 字段。`,
    );
  }

  if (route.kind === 'asr') {
    let audioDataUriOrUrl = '';
    // 上游只接受 system 角色的上下文，user/assistant 会被 InvalidParameter 拒，
    // 所以对话入口的文字一律折叠成一条 system 背景文本。
    const contextTexts: string[] = [];

    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'input_audio' && part.input_audio?.data) {
            const data = String(part.input_audio.data);
            const format = part.input_audio.format ?? 'wav';
            audioDataUriOrUrl =
              data.startsWith('data:') || data.startsWith('http') ? data : `data:audio/${format};base64,${data}`;
          } else if (part.type === 'audio_url' && part.audio_url?.url) {
            audioDataUriOrUrl = String(part.audio_url.url);
          } else if (part.type === 'text' && typeof part.text === 'string') {
            if (part.text.startsWith('data:audio/') || part.text.startsWith('http://') || part.text.startsWith('https://')) {
              audioDataUriOrUrl = part.text.trim();
            } else {
              contextTexts.push(part.text);
            }
          }
        }
      } else if (typeof msg.content === 'string') {
        const text = msg.content.trim();
        if (text.startsWith('data:audio/') || text.startsWith('http://') || text.startsWith('https://')) {
          audioDataUriOrUrl = text;
        } else {
          contextTexts.push(text);
        }
      }
    }

    if (!audioDataUriOrUrl) {
      return {
        text: '【Model Center 百炼 ASR 提示】未在请求消息中检测到有效的音频数据。请使用 OpenAI 标准 input_audio 格式或提供音频 Data URI / URL。',
      };
    }

    const asr = await callBailianAsr(provider, apiKey, {
      model: modelId,
      audioDataUriOrUrl,
      contextMessages: contextTexts.length > 0 ? [{ role: 'system', text: contextTexts.join('\n') }] : undefined,
      signal,
    });
    return { text: asr.text, seconds: asr.seconds };
  }

  let lastUserText = '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        lastUserText = msg.content;
      } else if (Array.isArray(msg.content)) {
        const textPart = msg.content.find((p: any) => p.type === 'text');
        if (textPart?.text) lastUserText = textPart.text;
      }
      if (lastUserText) break;
    }
  }

  if (!lastUserText) {
    return { text: '【Model Center 百炼 TTS 提示】未在请求中检测到待合成的文本。' };
  }

  const tts = await callBailianTts(provider, apiKey, { model: modelId, text: lastUserText, signal });
  return {
    text: `【语音合成完成】音频地址：${tts.audioUrl ?? '（见二进制响应）'}`,
    characters: tts.characters,
  };
}
