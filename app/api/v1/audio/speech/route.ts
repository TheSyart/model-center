import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { openaiErrorResponse } from '@/lib/gateway/errors';
import { runModalityRequest } from '@/lib/gateway/modality-pipeline';
import { withRawCapture } from '@/lib/raw-capture/capture';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';
import {
  acceptsBailianTts,
  bailianAudioRejectMessage,
  callBailianTts,
} from '@/lib/vendors/bailian/audio';

const FORMATS = ['wav', 'mp3', 'opus', 'pcm'] as const;
type SpeechFormat = (typeof FORMATS)[number];

// pcm 是裸采样，不是 WAV 容器；此前一并按 audio/wav 下发会让客户端按容器去解析。
const CONTENT_TYPES: Record<SpeechFormat, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  opus: 'audio/opus',
  pcm: 'audio/L16',
};

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
  const voice = typeof body.voice === 'string' ? body.voice.trim() : undefined;
  const speed = typeof body.speed === 'number' ? body.speed : undefined;

  return runModalityRequest({
    entry: 'openai',
    requestedModel: model,
    token: auth.token,
    source: normalizeRequestSource(req.headers.get('user-agent')),
    clientSignal: req.signal,
    accepts: acceptsBailianTts,
    rejectMessage: (target) => bailianAudioRejectMessage('TTS', target.modelId, target.provider.slug),
    errorResponse: (status, message, code) => openaiErrorResponse(status, message, { code }),
    execute: async ({ target, apiKey, signal }) => {
      const tts = await callBailianTts(target.provider, apiKey, {
        model: target.modelId,
        text,
        voice,
        format,
        rate: speed,
        signal,
      });

      if (tts.audioBuffer) {
        return {
          response: new Response(new Uint8Array(tts.audioBuffer), {
            headers: {
              'Content-Type': CONTENT_TYPES[format],
              'Content-Length': String(tts.audioBuffer.byteLength),
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
