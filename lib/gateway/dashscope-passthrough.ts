import { NextRequest, NextResponse } from 'next/server';
import { checkGatewayAuth } from './auth';
import { runModalityRequest } from './modality-pipeline';
import type { RouteTarget } from './router';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';
import type { ProviderRow } from '@/lib/services/provider';

/**
 * 百炼 DashScope 原生面的透传：客户端用阿里云 SDK 的原始路径与请求体，
 * 网关只替换鉴权与模型名，其余原样转发。
 *
 * 两条路径（多模态生成 / 语音合成）除了上游地址与准入判定之外完全一样，
 * 所以处理逻辑放在这里，路由文件只负责声明自己是哪一条。
 */

/** DashScope 的错误信封是 { code, message }，和 OpenAI 面的 { error: {...} } 不同。 */
function dashscopeError(status: number, message: string, code: string | null): Response {
  return NextResponse.json({ code: code ?? 'error', message }, { status });
}

export interface DashScopePassthroughOptions {
  accepts: (target: RouteTarget) => boolean;
  rejectMessage: (target: RouteTarget) => string;
  endpointFor: (provider: ProviderRow) => string;
}

export async function handleDashScopePassthrough(
  req: NextRequest,
  options: DashScopePassthroughOptions,
): Promise<Response> {
  const auth = checkGatewayAuth(req);
  if (!auth.ok) return dashscopeError(401, auth.message, auth.code);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return dashscopeError(400, '请求体必须是 JSON', 'invalid_json');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return dashscopeError(400, '请求体必须是 JSON 对象', 'invalid_json');
  }

  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model) return dashscopeError(400, '缺少 model 字段', 'invalid_request');

  // 此前会把 x-dashscope-sse 原样转给上游，却仍然用 .json() 读响应——
  // 客户端一旦请求 SSE 就会拿到一个解析失败的错误。明确拒绝比悄悄读坏好。
  const sse = req.headers.get('x-dashscope-sse');
  if (sse && sse.toLowerCase() !== 'disable') {
    return dashscopeError(400, '该转发接口暂不支持 SSE（X-DashScope-SSE: enable）', 'sse_not_supported');
  }

  return runModalityRequest({
    entry: 'openai',
    requestedModel: model,
    token: auth.token,
    source: normalizeRequestSource(req.headers.get('user-agent')),
    clientSignal: req.signal,
    accepts: options.accepts,
    rejectMessage: options.rejectMessage,
    errorResponse: dashscopeError,
    execute: async ({ target, apiKey, signal }) => {
      const upstream = await fetch(options.endpointFor(target.provider), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'disable',
        },
        // 客户端写的 model 可能是别名或 slug/model；上游只认真实模型名。
        body: JSON.stringify({ ...body, model: target.modelId }),
        signal,
      });

      const json = await upstream.json();
      return {
        response: NextResponse.json(json, { status: upstream.status }),
        status: upstream.status,
        error: upstream.ok ? null : JSON.stringify(json).slice(0, 300),
      };
    },
  });
}
