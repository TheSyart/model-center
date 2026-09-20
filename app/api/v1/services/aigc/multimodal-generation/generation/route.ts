import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleDashScopePassthrough } from '@/lib/gateway/dashscope-passthrough';
import { withRawCapture } from '@/lib/raw-capture/capture';
import {
  acceptsBailianMultimodalAudio,
  bailianAudioRejectMessage,
  getBailianMultimodalEndpoint,
} from '@/lib/vendors/bailian/audio';

// DashScope 原生多模态生成（语音识别走这条），路径与阿里云官方一致。
function handlePost(req: NextRequest): Promise<Response> {
  return handleDashScopePassthrough(req, {
    accepts: acceptsBailianMultimodalAudio,
    rejectMessage: (target) => bailianAudioRejectMessage('ASR', target.modelId, target.provider),
    endpointFor: (provider) => getBailianMultimodalEndpoint(provider.workspaceId),
  });
}

export const POST = withRawCapture(
  { entry: 'dashscope-asr', path: '/v1/services/aigc/multimodal-generation/generation' },
  handlePost,
);

export function GET() {
  return NextResponse.json({ code: 'method_not_allowed', message: 'Method not allowed' }, { status: 405 });
}
