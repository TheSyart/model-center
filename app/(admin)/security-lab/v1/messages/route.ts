import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { sqlite } from '@/lib/db';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { GatewayError, anthropicErrorResponse } from '@/lib/gateway/errors';
import { extractPromptExtension } from '@/lib/gateway/extensions';
import { runGatewayPipeline } from '@/lib/gateway/pipeline';
import { anthropicRequestToIR } from '@/lib/protocols/anthropic';
import { runSecurityLabRewrite } from '@/lib/security-lab/execution';
import { createSecurityLabStore } from '@/lib/security-lab/store';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';

export async function POST(req: NextRequest) {
  const auth = checkGatewayAuth(req);
  if (!auth.ok) return anthropicErrorResponse(401, auth.message);

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
  if (typeof model !== 'string' || !model) return anthropicErrorResponse(400, '缺少 model 字段');
  if (typeof body.max_tokens !== 'number') {
    return anthropicErrorResponse(400, '缺少 max_tokens 字段（Anthropic 协议必填）');
  }

  const prompt = extractPromptExtension(body);
  const source = normalizeRequestSource(req.headers.get('user-agent'));
  const store = createSecurityLabStore(sqlite);

  try {
    return await runSecurityLabRewrite({
      body,
      source,
      stream: body.stream === true,
    }, {
      getConfig: () => store.getConfig(),
      appendHistory: (record) => { store.appendHistory(record); },
      createId: () => crypto.randomUUID(),
      now: () => Date.now(),
      onHistoryError: (error) => {
        console.error('[security-lab] 写入改写历史失败', error);
      },
      forward: (rewrittenBody) => runGatewayPipeline({
        entry: 'anthropic',
        rawBody: rewrittenBody,
        ir: anthropicRequestToIR(rewrittenBody),
        requestedModel: model,
        stream: rewrittenBody.stream === true,
        includeUsage: true,
        clientSignal: req.signal,
        anthropicVersion: req.headers.get('anthropic-version'),
        prompt,
        token: auth.token,
        source,
      }),
    });
  } catch (error) {
    if (error instanceof GatewayError) return anthropicErrorResponse(error.status, error.message);
    const message = error instanceof Error ? error.message : String(error);
    return anthropicErrorResponse(500, `Security Lab 网关错误: ${message}`);
  }
}

export function GET() {
  return NextResponse.json(
    { type: 'error', error: { type: 'invalid_request_error', message: 'Method not allowed' } },
    { status: 405 },
  );
}
