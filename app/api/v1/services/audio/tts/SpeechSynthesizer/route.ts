import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleDashScopePassthrough } from '@/lib/gateway/dashscope-passthrough';
import { withRawCapture } from '@/lib/raw-capture/capture';
import {
  acceptsBailianTts,
  bailianAudioRejectMessage,
  getBailianTtsEndpoint,
} from '@/lib/services/dashscope-audio';

// DashScope 原生语音合成，路径与阿里云官方一致。
function handlePost(req: NextRequest): Promise<Response> {
  return handleDashScopePassthrough(req, {
    accepts: acceptsBailianTts,
    rejectMessage: (target) => bailianAudioRejectMessage('TTS', target.modelId, target.provider.slug),
    endpointFor: (provider) => getBailianTtsEndpoint(provider.workspaceId),
  });
}

export const POST = withRawCapture(
  { entry: 'dashscope-tts', path: '/v1/services/audio/tts/SpeechSynthesizer' },
  handlePost,
);

export function GET() {
  return NextResponse.json({ code: 'method_not_allowed', message: 'Method not allowed' }, { status: 405 });
}
