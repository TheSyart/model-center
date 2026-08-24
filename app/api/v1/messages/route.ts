import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { GatewayError, anthropicErrorResponse } from '@/lib/gateway/errors';
import { extractPromptExtension } from '@/lib/gateway/extensions';
import { runGatewayPipeline } from '@/lib/gateway/pipeline';
import { anthropicRequestToIR } from '@/lib/protocols/anthropic';
import { detectRequestSource } from '@/lib/services/usage-metrics';

/**
 * POST /api/v1/messages（对外 /v1/messages）：Anthropic 兼容出口，供 Claude Code 等 agent 直连。
 * 鉴权：x-api-key 或 Authorization: Bearer（同为 gateway_key）。
 * 错误一律 Anthropic 格式 { type:'error', error:{ type, message } }。
 */
export async function POST(req: NextRequest) {
  const auth = checkGatewayAuth(req);
  if (!auth.ok) {
    return anthropicErrorResponse(401, auth.message);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return anthropicErrorResponse(400, '请求体不是合法 JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return anthropicErrorResponse(400, '请求体必须是 JSON 对象');
  }
  const model = body.model;
  if (typeof model !== 'string' || !model) {
    return anthropicErrorResponse(400, '缺少 model 字段');
  }
  if (typeof body.max_tokens !== 'number') {
    return anthropicErrorResponse(400, '缺少 max_tokens 字段（Anthropic 协议必填）');
  }
  // 提取并剥离提示词扩展字段（M4 起生效）
  const prompt = extractPromptExtension(body);

  try {
    return await runGatewayPipeline({
      entry: 'anthropic',
      rawBody: body,
      ir: anthropicRequestToIR(body),
      requestedModel: model,
      stream: body.stream === true,
      includeUsage: true, // Anthropic 流式总是带 usage
      clientSignal: req.signal,
      anthropicVersion: req.headers.get('anthropic-version'),
      prompt,
      token: auth.token,
      source: detectRequestSource(req.headers.get('user-agent')),
    });
  } catch (e) {
    if (e instanceof GatewayError) return anthropicErrorResponse(e.status, e.message);
    const message = e instanceof Error ? e.message : String(e);
    return anthropicErrorResponse(500, `网关内部错误: ${message}`);
  }
}

export function GET() {
  return NextResponse.json(
    { type: 'error', error: { type: 'invalid_request_error', message: 'Method not allowed' } },
    { status: 405 },
  );
}
