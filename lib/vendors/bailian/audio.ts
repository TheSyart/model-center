import { isOfficialBailianCatalogProvider, normalizeBailianWorkspaceId } from './catalog.ts';
import type { ProviderRow } from '../../services/provider.ts';
import { UpstreamError } from '../../upstream-error.ts';
import { synthesizeOverWebSocket } from './tts-websocket.ts';

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

export interface BailianAsrOptions {
  model: string;
  /** base64 data URI 或公网可访问的 URL，两者实测都可用。 */
  audioDataUriOrUrl: string;
  languageHints?: string[];
  contextMessages?: Array<{ role: 'user' | 'assistant'; text: string }>;
  /** 客户端断连与超时；不传就既不会中止也没有上限。 */
  signal?: AbortSignal;
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

  const body: Record<string, unknown> = { model: options.model, input: { messages } };
  if (options.languageHints?.length) {
    body.parameters = { asr_options: { language: options.languageHints[0], enable_lid: true } };
  }

  const json = await post(
    getBailianMultimodalEndpoint(provider.workspaceId),
    apiKey,
    body,
    'ASR',
    options.signal,
    fetchImpl,
  );

  // output.choices[0].message.content 是数组；无语音内容时上游返回空数组。
  const content = json.output?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part: any) => (typeof part?.text === 'string' ? part.text : '')).join('')
    : typeof content === 'string'
      ? content
      : '';

  return { text, seconds: json.usage?.seconds, requestId: json.request_id, raw: json };
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

  const json = await post(
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
    const contextMsgs: Array<{ role: 'user' | 'assistant'; text: string }> = [];

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
              contextMsgs.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', text: part.text });
            }
          }
        }
      } else if (typeof msg.content === 'string') {
        const text = msg.content.trim();
        if (text.startsWith('data:audio/') || text.startsWith('http://') || text.startsWith('https://')) {
          audioDataUriOrUrl = text;
        } else {
          contextMsgs.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', text });
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
      contextMessages: contextMsgs,
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
