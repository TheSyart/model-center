import { isOfficialBailianCatalogProvider, normalizeBailianWorkspaceId } from './catalog.ts';
import { UpstreamError } from '../../upstream-error.ts';
import type { ProviderRow } from '../../services/provider.ts';

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
 * 语音接口的准入判定。
 *
 * 两条都必须成立才放行。上面的 getBailian*Endpoint 把阿里云主机写死在代码里、
 * 完全不读 provider.baseUrl，所以只要模型名里含 tts/asr 子串就放行，
 * 等于把任意服务商的 API Key 发到阿里云去。
 */
export function acceptsBailianAsr(target: { provider: ProviderRow; modelId: string }): boolean {
  return isOfficialBailianCatalogProvider(target.provider) && isBailianAsrModel(target.modelId);
}

export function acceptsBailianTts(target: { provider: ProviderRow; modelId: string }): boolean {
  return isOfficialBailianCatalogProvider(target.provider) && isBailianTtsModel(target.modelId);
}

/** 被拒时给客户端的说明，四个入口统一措辞。 */
export function bailianAudioRejectMessage(kind: 'ASR' | 'TTS', modelId: string, providerSlug: string): string {
  return `模型 "${modelId}"（服务商 ${providerSlug}）不是百炼官方目录下的${kind === 'ASR' ? '语音识别' : '语音合成'}模型；该接口只转发百炼 DashScope，不会把其它服务商的凭据发往阿里云。`;
}

export function getBailianAsrEndpoint(workspaceId?: string | null): string {
  const ws = normalizeBailianWorkspaceId(workspaceId);
  if (ws) {
    return `https://${ws}.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`;
  }
  return 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
}

export function getBailianTtsEndpoint(workspaceId?: string | null): string {
  const ws = normalizeBailianWorkspaceId(workspaceId);
  if (ws) {
    return `https://${ws}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`;
  }
  return 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer';
}

export interface BailianAsrOptions {
  model: string;
  audioDataUriOrUrl: string;
  format?: string; // wav, mp3, opus
  sampleRate?: number | string;
  languageHints?: string[];
  contextMessages?: Array<{ role: 'user' | 'assistant'; text: string }>;
  /** 客户端断连与超时；不传就既不会中止也没有上限。 */
  signal?: AbortSignal;
}

export interface BailianAsrResponse {
  text: string;
  duration?: number;
  requestId?: string;
  raw: unknown;
}

/**
 * 调用百炼 DashScope 原生 ASR 语音识别接口
 * 文档: https://help.aliyun.com/zh/model-studio/fun-asr-flash-recorded-speech-recognition-http-api
 */
export async function callBailianAsr(
  provider: ProviderRow,
  apiKey: string,
  options: BailianAsrOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<BailianAsrResponse> {
  const endpoint = getBailianAsrEndpoint(provider.workspaceId);

  const messages: unknown[] = [];
  if (options.contextMessages?.length) {
    for (const msg of options.contextMessages) {
      if (msg.role === 'user') {
        messages.push({
          role: 'user',
          content: [{ type: 'input_text', text: msg.text }],
        });
      } else {
        messages.push({
          role: 'assistant',
          content: [{ type: 'text', text: msg.text }],
        });
      }
    }
  }

  messages.push({
    role: 'user',
    content: [
      {
        type: 'input_audio',
        input_audio: {
          data: options.audioDataUriOrUrl,
        },
      },
    ],
  });

  const body = {
    model: options.model,
    input: { messages },
    parameters: {
      format: options.format ?? 'wav',
      sample_rate: String(options.sampleRate ?? '16000'),
      ...(options.languageHints?.length ? { language_hints: options.languageHints } : {}),
    },
  };

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-SSE': 'disable',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300);
    // 带上上游状态码：客户端请求写错了就该收到 4xx，不能一律兜成网关 500。
    throw new UpstreamError(res.status, `百炼 ASR 失败 (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as Record<string, any>;
  const text = json.output?.text ?? json.output?.sentence?.text ?? '';
  const duration = json.usage?.duration;
  const requestId = json.request_id;

  return { text, duration, requestId, raw: json };
}

export interface BailianTtsOptions {
  model: string;
  text: string;
  voice?: string;
  format?: 'wav' | 'mp3' | 'pcm' | 'opus';
  sampleRate?: number;
  volume?: number;
  rate?: number;
  pitch?: number;
  /** 客户端断连与超时；不传就既不会中止也没有上限。 */
  signal?: AbortSignal;
}

export interface BailianTtsResponse {
  audioUrl?: string;
  audioBuffer?: Buffer;
  characters?: number;
  requestId?: string;
  raw: unknown;
}

/**
 * 调用百炼 DashScope 原生 TTS 语音合成接口
 * 文档: https://help.aliyun.com/zh/model-studio/cosyvoice-tts-http-api
 */
export async function callBailianTts(
  provider: ProviderRow,
  apiKey: string,
  options: BailianTtsOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<BailianTtsResponse> {
  const endpoint = getBailianTtsEndpoint(provider.workspaceId);

  // 默认音色映射
  const defaultVoice = options.model.toLowerCase().includes('cosyvoice')
    ? 'longxiaochun_v3'
    : 'longanhuan_v3.6';

  const body = {
    model: options.model,
    input: {
      text: options.text,
      voice: options.voice ?? defaultVoice,
      format: options.format ?? 'wav',
      sample_rate: options.sampleRate ?? 24000,
      ...(options.volume !== undefined ? { volume: options.volume } : {}),
      ...(options.rate !== undefined ? { rate: options.rate } : {}),
      ...(options.pitch !== undefined ? { pitch: options.pitch } : {}),
    },
  };

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300);
    // 带上上游状态码：客户端请求写错了就该收到 4xx，不能一律兜成网关 500。
    throw new UpstreamError(res.status, `百炼 TTS 失败 (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as Record<string, any>;
  const audioUrl = json.output?.audio?.url;
  const characters = json.usage?.characters;
  const requestId = json.request_id;

  let audioBuffer: Buffer | undefined;
  if (audioUrl) {
    const audioRes = await fetchImpl(audioUrl, { signal: options.signal });
    if (audioRes.ok) {
      const arrayBuf = await audioRes.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuf);
    }
  }

  return { audioUrl, audioBuffer, characters, requestId, raw: json };
}

/**
 * 尝试通过 Chat Completions 格式兼容处理百炼 ASR 与 TTS 特殊模型
 */
export async function tryHandleBailianSpecialChat(
  provider: ProviderRow,
  apiKey: string,
  modelId: string,
  rawBody: Record<string, any>,
  signal?: AbortSignal,
): Promise<{ text: string; duration?: number; characters?: number } | null> {
  const isAsr = isBailianAsrModel(modelId);
  const isTts = isBailianTtsModel(modelId);

  if (!isAsr && !isTts) return null;

  const messages = Array.isArray(rawBody.messages) ? rawBody.messages : [];

  if (isAsr) {
    let audioDataUriOrUrl = '';
    const contextMsgs: Array<{ role: 'user' | 'assistant'; text: string }> = [];

    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'input_audio' && part.input_audio?.data) {
            const data = String(part.input_audio.data);
            const format = part.input_audio.format ?? 'wav';
            audioDataUriOrUrl = data.startsWith('data:') || data.startsWith('http')
              ? data
              : `data:audio/${format};base64,${data}`;
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

    const asrRes = await callBailianAsr(provider, apiKey, {
      model: modelId,
      audioDataUriOrUrl,
      contextMessages: contextMsgs,
      signal,
    });

    return { text: asrRes.text, duration: asrRes.duration };
  }

  if (isTts) {
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

    const ttsRes = await callBailianTts(provider, apiKey, {
      model: modelId,
      text: lastUserText,
      signal,
    });

    return {
      text: `【语音合成完成】音频地址：${ttsRes.audioUrl ?? '（见二进制响应）'}`,
      characters: ttsRes.characters,
    };
  }

  return null;
}
