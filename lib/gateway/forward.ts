const DEFAULT_TIMEOUT_MS = 120_000;
const ERROR_BODY_MAX = 64 * 1024;

export interface FetchSuccess {
  ok: true;
  upstream: Response;
  /** 到上游响应头（首包）的毫秒耗时 */
  latencyMs: number;
  /** 客户端断连监听已解除前需调用的清理函数 */
  cleanup: () => void;
}

export interface FetchFailure {
  ok: false;
  /** 可直接返回给客户端的响应（非 2xx 原样透传 / 502 网络错误） */
  response: Response;
  status: number;
  latencyMs: number;
  error: string;
}

export type FetchUpstreamResult = FetchSuccess | FetchFailure;

/**
 * 上游转发（§3.2 forwarder 职责）：只负责把请求发出去。
 * - 120s 超时（只约束到响应头返回，流式首包后不再限时）；
 * - 客户端断连（clientSignal abort）时中止上游请求；
 * - 非 2xx：读取错误体（截断 64KB），构造原样透传的响应。
 * 响应体如何转换由调用方（pipeline + 适配器）决定。
 */
export async function fetchUpstream(args: {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  clientSignal: AbortSignal;
  timeoutMs?: number;
  redirect?: RequestRedirect;
  discardErrorBody?: boolean;
}): Promise<FetchUpstreamResult> {
  const { url, headers, body, clientSignal } = args;
  const controller = new AbortController();
  const onClientAbort = () => controller.abort();
  clientSignal.addEventListener('abort', onClientAbort);
  if (clientSignal.aborted) controller.abort();
  const cleanup = () => clientSignal.removeEventListener('abort', onClientAbort);
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const startedAt = Date.now();

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: args.redirect,
    });
  } catch (e) {
    clearTimeout(timeout);
    cleanup();
    const latencyMs = Date.now() - startedAt;
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 502,
      latencyMs,
      error: `上游请求失败: ${message}`.slice(0, 500),
      response: Response.json(
        { error: { message: `上游请求失败: ${message}`, type: 'upstream_error', param: null, code: null } },
        { status: 502 },
      ),
    };
  }

  clearTimeout(timeout);
  const latencyMs = Date.now() - startedAt;
  const status = upstream.status;

  if (!upstream.ok) {
    cleanup();
    if(args.discardErrorBody) {
      await upstream.body?.cancel().catch(()=>{});
      return {ok:false,status,latencyMs,error:`上游返回 ${status}`,response:Response.json({error:{message:`上游返回 ${status}`}},{status})};
    }
    const text = await upstream.text();
    const truncated = text.length > ERROR_BODY_MAX ? text.slice(0, ERROR_BODY_MAX) : text;
    const contentType = upstream.headers.get('content-type') ?? 'application/json';
    return {
      ok: false,
      status,
      latencyMs,
      error: truncated.slice(0, 500) || `上游返回 ${status}`,
      response: new Response(truncated, { status, headers: { 'Content-Type': contentType } }),
    };
  }

  return { ok: true, upstream, latencyMs, cleanup };
}
