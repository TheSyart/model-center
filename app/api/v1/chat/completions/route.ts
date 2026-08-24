import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { GatewayError, gatewayErrorToResponse, openaiErrorResponse } from '@/lib/gateway/errors';
import { extractPromptExtension } from '@/lib/gateway/extensions';
import { runGatewayPipeline } from '@/lib/gateway/pipeline';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';

// POST /api/v1/chat/completions（对外经 rewrite 暴露为 /v1/chat/completions）
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
      entry: 'openai',
      rawBody: body,
      ir: body, // OpenAI 入口的请求体即 IR
      requestedModel: model,
      stream: body.stream === true,
      includeUsage: (body.stream_options as Record<string, unknown> | undefined)?.include_usage === true,
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

// 其余方法不允许
export function GET() {
  return NextResponse.json(
    { error: { message: 'Method not allowed', type: 'invalid_request_error', param: null, code: null } },
    { status: 405 },
  );
}
