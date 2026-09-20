import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { openaiErrorResponse } from '@/lib/gateway/errors';
import { modalityStreamDone, runModalityRequest } from '@/lib/gateway/modality-pipeline';
import { audioChunksToRawStream, audioChunksToSseStream } from '@/lib/gateway/audio-stream';
import { observeReadableStream } from '@/lib/gateway/stream-observer';
import { SSE_HEADERS, audioStreamHeaders } from '@/lib/gateway/stream-headers';
import { backfillWavSizes } from '@/lib/gateway/wav';
import { withRawCapture } from '@/lib/raw-capture/capture';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';
import { UpstreamError } from '@/lib/upstream-error';
import {
  acceptsBailianTts,
  bailianAudioRejectMessage,
  callBailianTts,
  canStreamBailianTts,
  normalizeBailianSpeechParams,
  openBailianTtsAudioStream,
  realtimeSiblingFor,
} from '@/lib/vendors/bailian/audio';
import type { BailianWsTtsCompletion } from '@/lib/vendors/bailian/tts-websocket';

const FORMATS = ['wav', 'mp3', 'opus', 'pcm'] as const;
type SpeechFormat = (typeof FORMATS)[number];

// 客户端请求的格式只是**期望**：Qwen-TTS 的请求体不收 format，实测固定返回 WAV。
// 所以响应头以实际拿到的音频为准，拿不到才退回这张表。
const CONTENT_TYPES: Record<SpeechFormat, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  opus: 'audio/opus',
  // pcm 是裸采样，不是 WAV 容器；按 audio/wav 下发会让客户端当容器去解析。
  pcm: 'audio/L16',
};

/**
 * OpenAI 的 stream_format：`audio` 直接分块下发字节，`sse` 走事件。
 * 不传就是缓冲整包——今天的行为，一字节不变。
 */
const STREAM_FORMATS = ['audio', 'sse'] as const;
type StreamFormat = (typeof STREAM_FORMATS)[number];

/** 单片下发 buffer，让「没有增量音频源的模型」也能满足流式契约。 */
async function* singleChunk(buffer: Buffer): AsyncGenerator<Uint8Array, void, undefined> {
  yield new Uint8Array(buffer);
}

// POST /api/v1/audio/speech（对外经 rewrite 暴露为 /v1/audio/speech）
async function handlePost(req: NextRequest): Promise<Response> {
  const auth = checkGatewayAuth(req);
  if (!auth.ok) {
    return openaiErrorResponse(401, auth.message, { type: 'authentication_error', code: auth.code });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return openaiErrorResponse(400, '请求体不是合法 JSON', { code: 'invalid_json' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return openaiErrorResponse(400, '请求体必须是 JSON 对象', { code: 'invalid_json' });
  }

  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model) return openaiErrorResponse(400, '缺少必需的模型参数 (model)', { param: 'model' });

  const text = typeof body.input === 'string' ? body.input.trim() : '';
  if (!text) return openaiErrorResponse(400, '缺少必需的待合成文本 (input)', { param: 'input' });

  const format: SpeechFormat = FORMATS.includes(body.response_format as SpeechFormat)
    ? (body.response_format as SpeechFormat)
    : 'wav';
  const streamFormat: StreamFormat | null = STREAM_FORMATS.includes(body.stream_format as StreamFormat)
    ? (body.stream_format as StreamFormat)
    // `stream: true` 是参考文档里的写法，等价于 stream_format: "audio"。
    : body.stream === true
      ? 'audio'
      : null;
  const voice = typeof body.voice === 'string' ? body.voice.trim() : undefined;
  // speed 是 OpenAI 标准字段；pitch / volume / instructions 是扩展，不传不影响兼容。
  const { rate: speed, pitch, volume } = normalizeBailianSpeechParams(body);
  const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : undefined;
  // Qwen-TTS 的 language_type（如 Chinese / English）；其它族忽略。
  const languageType = typeof body.language === 'string' ? body.language.trim() : undefined;
  const sampleRate = typeof body.sample_rate === 'number' ? body.sample_rate : undefined;

  /** 流式分支。到 openBailianTtsAudioStream 解析为止都还能变成 HTTP 4xx。 */
  async function streamSpeech({
    target,
    apiKey,
    signal,
    startedAt,
  }: {
    target: { provider: any; modelId: string };
    apiKey: string;
    signal: AbortSignal;
    startedAt: number;
  }) {
    let chunks: AsyncGenerator<Uint8Array, void, undefined>;
    let completion: Promise<BailianWsTtsCompletion>;
    let contentType: string;
    let buffered = false;

    if (canStreamBailianTts(target.modelId)) {
      const opened = await openBailianTtsAudioStream(target.provider, apiKey, {
        model: target.modelId,
        text,
        voice,
        format,
        sampleRate,
        rate: speed,
        pitch,
        volume,
        instructions,
        languageType,
        signal,
      });
      chunks = opened.chunks;
      completion = opened.completion;
      contentType = opened.contentType;
    } else {
      /**
       * Qwen-TTS 走 HTTP，只给一个下载地址，没有分片可言。
       *
       * 仍然按流式形状下发，而不是对半个语音目录拒绝 stream_format——线上格式
       * 一样合法，SDK 用起来没有区别，只是首包时间没有改善。用一个响应头把这件事
       * 说清楚，免得调用方以为流式没生效。
       */
      const tts = await callBailianTts(target.provider, apiKey, {
        model: target.modelId,
        text,
        voice,
        format,
        sampleRate,
        rate: speed,
        pitch,
        volume,
        instructions,
        languageType,
        signal,
      });
      if (!tts.audioBuffer) {
        throw new UpstreamError(502, '百炼 TTS 未能生成音频');
      }
      buffered = true;
      // 这条路也是整包在手，长度同样可以回填。
      chunks = singleChunk(Buffer.from(backfillWavSizes(new Uint8Array(tts.audioBuffer))));
      completion = Promise.resolve({
        reason: 'finished' as const,
        characters: tts.characters,
        requestId: tts.requestId,
      });
      contentType = tts.contentType ?? CONTENT_TYPES[format];
    }

    let settled: BailianWsTtsCompletion | null = null;
    void completion.then((c) => { settled = c; });

    const body =
      streamFormat === 'sse'
        ? audioChunksToSseStream(chunks, completion, () => {})
        : audioChunksToRawStream(chunks, () => {});
    const observed = observeReadableStream(body, startedAt);

    const headers: Record<string, string> = {
      ...(streamFormat === 'sse' ? SSE_HEADERS : audioStreamHeaders(contentType)),
      'X-Model-Center-Upstream-Model': target.modelId,
    };
    if (buffered) {
      headers['X-Model-Center-Stream'] = 'buffered';
      const sibling = realtimeSiblingFor(target.modelId);
      if (sibling) {
        // 只提示，不替换：自定义音色绑定 target_model，换族会让已复刻的音色失效，
        // 这个代价得由调用方自己决定。
        headers['X-Model-Center-Stream-Hint'] =
          `${sibling} streams incrementally; switching model family invalidates cloned voices`;
      }
    }

    return {
      response: new Response(observed.stream, { status: 200, headers }),
      stream: {
        done: modalityStreamDone(observed.timing, () => {
          const reason = settled?.reason;
          if (!reason || reason === 'finished') return null;
          /**
           * 走到这里状态码已经定死 200，日志是唯一还能说出真相的地方。
           *
           * 客户端挂断也要在这里说：断连是以异常的形式从**读取**路径回来的，
           * 而 observeReadableStream 只有在自己的 cancel() 被调用时才标 cancelled，
           * 所以光靠 timing.cancelled 看不出来。
           */
          if (reason === 'cancelled') return '客户端中断流';
          return `上游流异常: ${reason}`;
        }),
      },
    };
  }

  return runModalityRequest({
    entry: 'openai',
    requestedModel: model,
    token: auth.token,
    source: normalizeRequestSource(req.headers.get('user-agent')),
    clientSignal: req.signal,
    accepts: acceptsBailianTts,
    rejectMessage: (target) => bailianAudioRejectMessage('TTS', target.modelId, target.provider),
    errorResponse: (status, message, code) => openaiErrorResponse(status, message, { code }),
    execute: async ({ target, apiKey, signal, startedAt }) => {
      if (streamFormat) {
        return streamSpeech({ target, apiKey, signal, startedAt });
      }

      const tts = await callBailianTts(target.provider, apiKey, {
        model: target.modelId,
        text,
        voice,
        format,
        sampleRate,
        rate: speed,
        pitch,
        volume,
        instructions,
        languageType,
        signal,
      });

      if (tts.audioBuffer) {
        /**
         * 上游边合成边发，WAV 头里的长度是 ≈2GB 的占位值。非流式这条路整包都在手上，
         * 长度完全知道——回填它，免得严格按头部长度读的解析器认为文件被截断。
         */
        const audio = Buffer.from(backfillWavSizes(new Uint8Array(tts.audioBuffer)));
        return {
          response: new Response(new Uint8Array(audio), {
            headers: {
              'Content-Type': tts.contentType ?? CONTENT_TYPES[format],
              'Content-Length': String(audio.byteLength),
            },
          }),
        };
      }
      if (tts.audioUrl) {
        // 合成成功但音频没下载下来时，把上游的临时地址交给客户端自取。
        return { response: NextResponse.redirect(tts.audioUrl) };
      }
      const message = '百炼 TTS 未能生成音频';
      return {
        response: openaiErrorResponse(502, message, { type: 'api_error', code: 'upstream_no_audio' }),
        error: message,
      };
    },
  });
}

export const POST = withRawCapture({ entry: 'audio-speech', path: '/v1/audio/speech' }, handlePost);

export function GET() {
  return openaiErrorResponse(405, 'Method not allowed');
}
