import { isOfficialBailianCatalogProvider } from '../vendors/bailian/catalog.ts';

/**
 * 百炼 DashScope 原生路径透传的**纯函数层**：白名单、请求头策略、选服务商、上游地址。
 *
 * 这一层不认识 Next、不认识数据库，HTTP catch-all 与 WebSocket 桥接都只调它。
 * 零框架依赖也意味着 `npm run test:core` 能在 node 的 strip-only 模式下直接测。
 *
 * 透传的原则只有一条：**网关只做「认网关 key → 换百炼 key → 注入业务空间头 → 记账」，
 * 其余字节原样转发。** 不改写 model、不改写响应体、不改写上游给的 OSS 地址。
 *
 * 上游走**公共域名** + `X-DashScope-WorkSpace` 头，而不是 workspace 专有域名：
 * 专有域名会把 4xx 的错误体吞成空 `{}`（docs/vendor-apis/bailian.md 有记），
 * 透传的调用方要的正是原始错误。2026-09-21 实测公共域名 + 头：HTTP 三条路径 200，
 * WebSocket 出音 119040 字节、首包 352ms。
 */

export const DASHSCOPE_PUBLIC_HOST = 'dashscope.aliyuncs.com';

export type PassthroughMethod = 'GET' | 'POST' | 'WS';

export interface PassthroughRoute {
  method: PassthroughMethod;
  /** 以 `/` 结尾按前缀匹配（后面跟 task_id），否则整段相等。 */
  prefix: string;
  /** 谁在用、漏了会怎样——来自需求方逐条提取的清单。 */
  note: string;
}

/**
 * 白名单就是调用方实际会打的全部路径。**别把 `/api/v1/*` 整段敞开**：
 * 那等于把百炼账号变成任何拿到网关 key 的人的开放代理。
 */
export const DASHSCOPE_PASSTHROUGH_ROUTES: readonly PassthroughRoute[] = [
  { method: 'POST', prefix: '/api/v1/services/aigc/multimodal-generation/generation', note: '语音识别、千问图像' },
  { method: 'POST', prefix: '/api/v1/services/audio/tts/SpeechSynthesizer', note: '音色页试听' },
  { method: 'POST', prefix: '/api/v1/services/audio/tts/customization', note: '声音复刻 / 设计 / 查询 / 删除' },
  { method: 'GET', prefix: '/api/v1/uploads', note: '复刻样本上传：取 OSS 直传策略' },
  { method: 'POST', prefix: '/api/v1/services/aigc/image-generation/generation', note: '文生图（万相，异步）' },
  { method: 'GET', prefix: '/api/v1/tasks/', note: '异步任务轮询' },
  { method: 'POST', prefix: '/api/v1/services/audio/asr/transcription', note: '录音文件转写（异步）' },
  { method: 'WS', prefix: '/api-ws/v1/inference', note: '语音合成流式（协议 A）' },
  { method: 'WS', prefix: '/api-ws/v1/realtime', note: '语音合成流式（协议 B，model 在 query）' },
];

function pathMatches(route: PassthroughRoute, pathname: string): boolean {
  if (route.prefix.endsWith('/')) return pathname.startsWith(route.prefix) && pathname.length > route.prefix.length;
  return pathname === route.prefix;
}

export function matchPassthroughRoute(method: string, pathname: string): PassthroughRoute | null {
  const upper = method.toUpperCase();
  for (const route of DASHSCOPE_PASSTHROUGH_ROUTES) {
    if (route.method === upper && pathMatches(route, pathname)) return route;
  }
  return null;
}

/** 路径在白名单里但方法不对——该回 405 而不是 404。 */
export function pathIsPassthrough(pathname: string): boolean {
  return DASHSCOPE_PASSTHROUGH_ROUTES.some((route) => route.method !== 'WS' && pathMatches(route, pathname));
}

// ---------- 选服务商 ----------

export interface ProviderCandidate {
  slug: string;
  presetKey?: string | null;
  enabled: number;
  priority: number;
  createdAt?: number | null;
  workspaceId?: string | null;
}

/**
 * 透传没有 model 可解析（`/api/v1/tasks/{id}` 根本没有 model，`voice-enrollment` 是伪模型），
 * 所以不走 resolveModel，直接挑「那个百炼服务商」：启用、在官方目录里，
 * 优先 presetKey 精确等于 bailian 的，再按 priority 高者、先建者。
 */
export function pickDashScopeProvider<T extends ProviderCandidate>(rows: readonly T[]): T | null {
  const candidates = rows.filter((row) => row.enabled === 1 && isOfficialBailianCatalogProvider(row));
  if (candidates.length === 0) return null;
  const score = (row: T) => (row.presetKey === 'bailian' ? 1 : 0);
  return [...candidates].sort(
    (a, b) =>
      score(b) - score(a) ||
      b.priority - a.priority ||
      (a.createdAt ?? Number.MAX_SAFE_INTEGER) - (b.createdAt ?? Number.MAX_SAFE_INTEGER),
  )[0];
}

// ---------- 上游地址 ----------

/** query 原样保留：realtime 协议的 model 就在 `?model=` 上。 */
export function upstreamHttpUrl(pathname: string, search: string): string {
  return `https://${DASHSCOPE_PUBLIC_HOST}${pathname}${search}`;
}

export function upstreamWsUrl(pathname: string, search: string): string {
  return `wss://${DASHSCOPE_PUBLIC_HOST}${pathname}${search}`;
}

// ---------- 请求头策略 ----------

/**
 * 出站时**剥掉**的头。三类：
 *  - 鉴权与业务空间：由网关注入，客户端带的一律不信（否则能指定到别的业务空间）；
 *  - hop-by-hop 与长度：由这一跳自己决定，透传会打架；
 *  - 代理与客户端痕迹：cookie、x-forwarded-*、cf-* 对上游没意义，也不该泄露。
 * 没列在这里的**全部原样透传**——`X-DashScope-Async`、`X-DashScope-OssResourceResolve`、
 * `X-DashScope-SSE`、`Content-Type` 都靠这一条到达上游。
 */
const STRIP_OUTBOUND = new Set([
  'host',
  'authorization',
  'x-api-key',
  'x-dashscope-workspace',
  'content-length',
  'accept-encoding',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
  'expect',
  'cookie',
  'x-real-ip',
]);
const STRIP_OUTBOUND_PREFIXES = ['proxy-', 'x-forwarded-', 'cf-', 'sec-websocket-'];

/** 入站时剥掉的头：编码与长度由这一跳重算，hop-by-hop 与 cookie 不该跨代理。 */
const STRIP_INBOUND = new Set([
  'content-encoding',
  'content-length',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'set-cookie',
]);

type HeaderSource = Headers | Iterable<[string, string]> | Record<string, string | string[] | undefined>;

function* entriesOf(source: HeaderSource): Iterable<[string, string]> {
  if (typeof (source as Headers).forEach === 'function' && typeof (source as Headers).get === 'function') {
    const pairs: [string, string][] = [];
    (source as Headers).forEach((value, key) => pairs.push([key, value]));
    yield* pairs;
    return;
  }
  if (typeof (source as Iterable<[string, string]>)[Symbol.iterator] === 'function') {
    yield* source as Iterable<[string, string]>;
    return;
  }
  for (const [key, value] of Object.entries(source as Record<string, string | string[] | undefined>)) {
    if (value === undefined) continue;
    yield [key, Array.isArray(value) ? value.join(', ') : value];
  }
}

function isStrippedOutbound(name: string): boolean {
  return STRIP_OUTBOUND.has(name) || STRIP_OUTBOUND_PREFIXES.some((p) => name.startsWith(p));
}

export function outboundHeaders(
  client: HeaderSource,
  apiKey: string,
  workspaceId: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawName, value] of entriesOf(client)) {
    const name = rawName.toLowerCase();
    if (isStrippedOutbound(name)) continue;
    out[name] = value;
  }
  out['authorization'] = `Bearer ${apiKey}`;
  // 字节原样、长度可信：让上游别压缩。
  out['accept-encoding'] = 'identity';
  const ws = workspaceId?.trim();
  if (ws) out['x-dashscope-workspace'] = ws;
  return out;
}

export function inboundHeaders(upstream: HeaderSource): Headers {
  const out = new Headers();
  let contentType = '';
  for (const [rawName, value] of entriesOf(upstream)) {
    const name = rawName.toLowerCase();
    if (STRIP_INBOUND.has(name)) continue;
    if (name === 'content-type') contentType = value;
    out.append(name, value);
  }
  if (contentType.toLowerCase().startsWith('text/event-stream')) {
    // nginx 默认 proxy_buffering on，会把整条 SSE 攒完再发。
    out.set('x-accel-buffering', 'no');
  }
  return out;
}

// ---------- 记账辅助 ----------

/**
 * 从 JSON 请求体里取 `model` 供日志用。
 * 解析失败一律返回 null——记账拿不到模型名是小事，**绝不能因此影响转发**。
 */
export function extractModel(body: Uint8Array | null, contentType: string | null): string | null {
  if (!body || body.byteLength === 0) return null;
  if (!contentType || !contentType.toLowerCase().includes('json')) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body));
    const model = parsed && typeof parsed === 'object' ? (parsed as { model?: unknown }).model : undefined;
    return typeof model === 'string' && model.trim() ? model.trim() : null;
  } catch {
    return null;
  }
}

/** DashScope 的错误信封是 `{ code, message }`，和 OpenAI 面的 `{ error: {...} }` 不同。 */
export function dashscopeErrorBody(code: string, message: string): { code: string; message: string } {
  return { code, message };
}
