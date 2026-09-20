import { NextRequest, NextResponse, after } from 'next/server';
import { checkGatewayAuth } from '@/lib/gateway/auth';
import { writeRequestLog } from '@/lib/gateway/logger';
import {
  dashscopeErrorBody,
  extractModel,
  inboundHeaders,
  matchPassthroughRoute,
  outboundHeaders,
  pathIsPassthrough,
  pickDashScopeProvider,
  upstreamHttpUrl,
} from '@/lib/passthrough/dashscope';
import { listProviders, readProviderApiKey } from '@/lib/services/provider';
import { checkSpendLimit, SPEND_WINDOW_LABELS } from '@/lib/services/token';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';

/**
 * 百炼 DashScope 原生路径的透传（catch-all）。
 *
 * Next 的静态段优先于 catch-all：`chat/completions`、`messages`、`responses`、`models`、
 * `audio/*` 都不会落到这里；`/v1/*` 的 rewrite 与直打 `/api/v1/*` 都会。
 * 进来之后只认 lib/passthrough/dashscope.ts 里那 9 条白名单，其余 404。
 *
 * 网关只做：认网关 key → 换百炼 key → 注入业务空间头 → 记账。
 * 不改写 model、不改写响应体、不改写上游给的 OSS 地址，SSE 原样流过去。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 只约束到响应头：ASR 带几 MB 音频可能十几秒，万相异步提交与轮询都是秒回。 */
const HEADER_TIMEOUT_MS = 120_000;
/** 非 2xx 的响应体读进来记日志，只取这么多。 */
const ERROR_EXCERPT = 300;

function fail(status: number, code: string, message: string): Response {
  return NextResponse.json(dashscopeErrorBody(code, message), { status });
}

function hasBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: Ctx): Promise<Response> {
  const startedAt = Date.now();
  const segments = (await ctx.params).path ?? [];
  // 从 params 拼路径而不是读 nextUrl：经 /v1 rewrite 进来时两者才一定一致。
  const pathname = `/api/v1/${segments.join('/')}`;
  const search = req.nextUrl.search;

  const auth = checkGatewayAuth(req);
  if (!auth.ok) return fail(401, auth.code, auth.message);

  const route = matchPassthroughRoute(req.method, pathname);
  if (!route) {
    return pathIsPassthrough(pathname)
      ? fail(405, 'method_not_allowed', `路径 ${pathname} 不接受 ${req.method}`)
      : fail(404, 'not_found', `路径 ${pathname} 不在透传白名单内`);
  }

  const provider = pickDashScopeProvider(listProviders());
  if (!provider) return fail(503, 'dashscope_provider_missing', '网关未配置百炼服务商');

  const limit = checkSpendLimit(auth.token);
  if (limit.exceeded) {
    return fail(
      429,
      'spend_limit_exceeded',
      `令牌「${auth.token.name}」已超出${SPEND_WINDOW_LABELS[limit.window ?? 'total']}限额 $${limit.limit}（已用 $${limit.spent.toFixed(4)}）`,
    );
  }

  let apiKey: string;
  try {
    apiKey = readProviderApiKey(provider);
  } catch (e) {
    return fail(503, 'dashscope_provider_unusable', e instanceof Error ? e.message : String(e));
  }

  const log = (status: number, error: string | null, modelId: string | null, stream: boolean) => {
    const latencyMs = Date.now() - startedAt;
    after(() =>
      writeRequestLog({
        ts: startedAt,
        providerId: provider.id,
        modelId,
        alias: null,
        tokenId: auth.token.id,
        tokenName: auth.token.name,
        tokenPrefix: auth.token.prefix,
        entryProtocol: 'dashscope',
        upstreamProtocol: 'dashscope',
        source: normalizeRequestSource(req.headers.get('user-agent')),
        status,
        latencyMs,
        durationMs: latencyMs,
        // 透传拿不到统一口径的用量，且语音/图片本来就不按 token 计价。
        usage: null,
        error,
        stream,
      }),
    );
  };

  // JSON 请求体读进来是为了取 model 记账；其它类型直接流过去，一个字节不碰。
  const contentType = req.headers.get('content-type');
  let body: BodyInit | null = null;
  let modelId: string | null = null;
  if (hasBody(req.method)) {
    if (contentType?.toLowerCase().includes('json')) {
      const bytes = new Uint8Array(await req.arrayBuffer());
      modelId = extractModel(bytes, contentType);
      body = bytes;
    } else {
      body = req.body;
    }
  }

  const controller = new AbortController();
  const onClientAbort = () => controller.abort();
  req.signal.addEventListener('abort', onClientAbort);
  if (req.signal.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), HEADER_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamHttpUrl(pathname, search), {
      method: req.method,
      headers: outboundHeaders(req.headers, apiKey, provider.workspaceId),
      body,
      signal: controller.signal,
      // 上游给的 3xx（比如 OSS 地址）原样回给客户端，网关不代跳。
      redirect: 'manual',
      // 请求体是流时 fetch 要求显式声明。
      ...(body && typeof (body as ReadableStream).getReader === 'function' ? { duplex: 'half' } : {}),
    } as RequestInit);
  } catch (e) {
    clearTimeout(timer);
    req.signal.removeEventListener('abort', onClientAbort);
    const aborted = controller.signal.aborted;
    const message = aborted
      ? req.signal.aborted
        ? '客户端已断开连接'
        : `上游在 ${HEADER_TIMEOUT_MS}ms 内没有返回响应头`
      : e instanceof Error
        ? e.message
        : String(e);
    log(aborted ? 504 : 502, message, modelId, false);
    return fail(aborted ? 504 : 502, aborted ? 'upstream_timeout' : 'upstream_unreachable', message);
  }
  // 响应头到了，超时的使命结束；断连监听留着，流到一半客户端走了要能中止上游。
  clearTimeout(timer);

  const headers = inboundHeaders(upstream.headers);
  const stream = (upstream.headers.get('content-type') ?? '').toLowerCase().startsWith('text/event-stream');

  if (!upstream.ok && upstream.status < 300) {
    // 不会发生（ok 覆盖 2xx），留给类型系统。
  }
  if (upstream.status >= 400) {
    // 错误体很小，读进来记日志再原样回去。
    const errorBytes = new Uint8Array(await upstream.arrayBuffer());
    req.signal.removeEventListener('abort', onClientAbort);
    log(upstream.status, new TextDecoder().decode(errorBytes).slice(0, ERROR_EXCERPT), modelId, false);
    return new Response(errorBytes, { status: upstream.status, headers });
  }

  log(upstream.status, null, modelId, stream);
  if (!upstream.body) {
    req.signal.removeEventListener('abort', onClientAbort);
    return new Response(null, { status: upstream.status, headers });
  }
  // 流式透传。断连监听在流结束时才摘：客户端走了，上游也该停。
  const observed = upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      flush() {
        req.signal.removeEventListener('abort', onClientAbort);
      },
    }),
  );
  return new Response(observed, { status: upstream.status, headers });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
