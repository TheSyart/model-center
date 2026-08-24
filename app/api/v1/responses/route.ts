import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { GatewayError, gatewayErrorToResponse, openaiErrorResponse } from '@/lib/gateway/errors';
import { extractPromptExtension } from '@/lib/gateway/extensions';
import { runGatewayPipeline } from '@/lib/gateway/pipeline';
import { responsesRequestToIR } from '@/lib/protocols/responses';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';

/**
 * POST /api/v1/responses（对外 /v1/responses）：OpenAI Responses API 出口（Codex 类客户端）。
 * 鉴权：Authorization: Bearer <gateway_key>。错误沿用 OpenAI 错误 JSON 格式。
 * 目标 provider 为 openai-responses 原生协议时直接透传，否则经 IR 转换（§3.2）。
 */
export async function POST(req: NextRequest) {
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
  const model = body.model;
  if (typeof model !== 'string' || !model) {
    return openaiErrorResponse(400, '缺少 model 字段', { param: 'model' });
  }
  // 提取并剥离提示词扩展字段（M4 起生效）
  const prompt = extractPromptExtension(body);

  try {
    return await runGatewayPipeline({
      entry: 'responses',
      rawBody: body,
      ir: responsesRequestToIR(body),
      requestedModel: model,
      stream: body.stream === true,
      includeUsage: true, // Responses 流式 response.completed 总带 usage
      clientSignal: req.signal,
      prompt,
      token: auth.token,
      source: normalizeRequestSource(req.headers.get('user-agent')),
    });
  } catch (e) {
    if (e instanceof GatewayError) return gatewayErrorToResponse(e);
    const message = e instanceof Error ? e.message : String(e);
    return openaiErrorResponse(500, `网关内部错误: ${message}`, { type: 'server_error' });
  }
}

export function GET() {
  return NextResponse.json(
    { error: { message: 'Method not allowed', type: 'invalid_request_error', param: null, code: null } },
    { status: 405 },
  );
}
