import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { openaiErrorResponse } from '@/lib/gateway/errors';
import { runModalityRequest } from '@/lib/gateway/modality-pipeline';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';
import { acceptsBailianVoiceCustomization, bailianVoiceRejectMessage } from '@/lib/vendors/bailian/audio';
import { deleteBailianVoice, getBailianVoice } from '@/lib/vendors/bailian/voices';

/**
 * 单条音色的查询与删除。
 *
 * `model` 走 query string 而不是路径：音色绑定目标合成模型，上游的两套 API
 * 按它分流，而 DELETE 没有请求体可以放它。
 */

type Ctx = { params: Promise<{ id: string }> };

function run(
  req: NextRequest,
  voiceId: string,
  execute: Parameters<typeof runModalityRequest>[0]['execute'],
): Response | Promise<Response> {
  const auth = checkGatewayAuth(req);
  if (!auth.ok) {
    return openaiErrorResponse(401, auth.message, { type: 'authentication_error', code: auth.code });
  }
  const model = req.nextUrl.searchParams.get('model')?.trim();
  if (!model) {
    return openaiErrorResponse(400, '缺少必需的 model 参数：音色绑定目标合成模型，要指明是哪一个', {
      param: 'model',
    });
  }
  if (!voiceId) return openaiErrorResponse(400, '缺少音色 ID', { param: 'id' });

  return runModalityRequest({
    entry: 'openai',
    requestedModel: model,
    token: auth.token,
    source: normalizeRequestSource(req.headers.get('user-agent')),
    clientSignal: req.signal,
    accepts: acceptsBailianVoiceCustomization,
    rejectMessage: (target) => bailianVoiceRejectMessage(target.modelId, target.provider),
    errorResponse: (status, message, code) => openaiErrorResponse(status, message, { code }),
    execute,
  });
}

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  return run(req, id, async ({ target, apiKey, signal }) => {
    const voice = await getBailianVoice(target.provider, apiKey, {
      targetModel: target.modelId,
      voiceId: id,
      signal,
    });
    return {
      response: NextResponse.json({
        id: voice.id,
        object: 'audio.voice',
        target_model: voice.targetModel ?? null,
        status: voice.status ?? null,
        created_at: voice.createdAt ?? null,
        updated_at: voice.updatedAt ?? null,
      }),
    };
  });
}

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  return run(req, id, async ({ target, apiKey, signal }) => {
    await deleteBailianVoice(target.provider, apiKey, { targetModel: target.modelId, voiceId: id, signal });
    return { response: NextResponse.json({ id, object: 'audio.voice', deleted: true }) };
  });
}
