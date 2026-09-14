import { StoreError } from './store.ts';

/** Explicit deployment authority, shared by CSRF checks and OAuth cookie security.
 * Forwarded headers are deliberately not trusted; configure the externally visible
 * origin when TLS is terminated before Next.js. */
export function subscriptionPublicOrigin(req: Request): string {
  const configured = process.env.MODEL_CENTER_PUBLIC_ORIGIN?.trim();
  if (configured) {
    let url: URL;
    try {
      url = new URL(configured);
    } catch {
      throw new StoreError(
        'MODEL_CENTER_PUBLIC_ORIGIN 必须是完整的 HTTP(S) origin',
        500
      );
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new StoreError(
        'MODEL_CENTER_PUBLIC_ORIGIN 只能包含 HTTP(S) 协议、主机和可选端口',
        500
      );
    }
    return url.origin;
  }
  const target = new URL(req.url);
  // Next can use an internal localhost URL; Host retains browser authority.
  const host = req.headers.get('host');
  if (host) {
    if (!/^[a-zA-Z0-9.:[\]-]+$/.test(host))
      throw new StoreError('请求来源无效', 403);
    target.host = host;
  }
  return target.origin;
}

export function assertSubscriptionMutation(req: Request) {
  const origin = req.headers.get('origin');
  const expected = subscriptionPublicOrigin(req);
  if (
    !origin ||
    origin !== expected ||
    req.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new StoreError('请从当前 Model Center 页面执行此操作', 403);
  if (
    req.method !== 'DELETE' &&
    !/^application\/json(?:;|$)/i.test(req.headers.get('content-type') ?? '')
  )
    throw new StoreError('请求必须使用 JSON', 415);
}

export async function readSubscriptionBody(
  req: Request
): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw new StoreError('请求体不能为空');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16384) {
        await reader.cancel();
        throw new StoreError('请求体过大', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new StoreError('请求体不是合法 JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new StoreError('请求体必须是 JSON 对象');
  return parsed as Record<string, unknown>;
}

export function subscriptionResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit
) {
  const h = new Headers(headers);
  h.set('Cache-Control', 'no-store');
  h.set('Referrer-Policy', 'no-referrer');
  h.set('X-Content-Type-Options', 'nosniff');
  return Response.json(body, { status, headers: h });
}
