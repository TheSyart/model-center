import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { resolveModel } from '@/lib/gateway/router';
import { decrypt } from '@/lib/crypto';
import { getBailianAsrEndpoint } from '@/lib/services/dashscope-audio';
import { writeRequestLog } from '@/lib/gateway/logger';

export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = checkGatewayAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ code: auth.code, message: auth.message }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'invalid_json', message: '请求体必须是 JSON' }, { status: 400 });
  }

  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model) {
    return NextResponse.json({ code: 'invalid_request', message: '缺少 model 字段' }, { status: 400 });
  }

  try {
    const route = resolveModel(model);
    const target = route.targets[0];
    const apiKey = decrypt(target.provider.apiKeyEnc);
    const upstreamUrl = getBailianAsrEndpoint(target.provider.workspaceId);

    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(req.headers.get('x-dashscope-sse') ? { 'X-DashScope-SSE': req.headers.get('x-dashscope-sse')! } : {}),
      },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - start;
    const json = await upstreamRes.json();

    writeRequestLog({
      ts: Date.now(),
      providerId: target.provider.id,
      modelId: target.modelId,
      alias: route.alias,
      tokenId: auth.token?.id,
      tokenName: auth.token?.name,
      tokenPrefix: auth.token?.prefix,
      entryProtocol: 'openai',
      upstreamProtocol: target.provider.protocol,
      status: upstreamRes.status,
      latencyMs,
      usage: json.usage?.duration
        ? {
            prompt_tokens: Math.round(json.usage.duration * 10),
            completion_tokens: (json.output?.text ?? '').length,
            total_tokens: Math.round(json.usage.duration * 10) + (json.output?.text ?? '').length,
          }
        : null,
      error: upstreamRes.ok ? null : JSON.stringify(json),
      stream: false,
    });

    return NextResponse.json(json, { status: upstreamRes.status });
  } catch (err: any) {
    return NextResponse.json({ code: 'internal_error', message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
