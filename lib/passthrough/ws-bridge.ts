import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import {
  extractModel,
  matchPassthroughRoute,
  outboundHeaders,
  upstreamWsUrl,
} from './dashscope.ts';

/**
 * WebSocket 桥接：客户端 ↔ 网关 ↔ 百炼，两个方向的帧原样互转。
 *
 * 这是透传里唯一要下功夫的一条。Next 的路由处理器永远看不见 `Upgrade` 请求——
 * 它在 Node 层就分流成 `'upgrade'` 事件了——所以这个处理器由 server.ts 直接挂在
 * http.Server 上。它经 instrumentation.ts 发布到 globalThis，因为 server.ts 是
 * Next 之外的普通文件，用不了 `@/` 别名，而鉴权/解密/日志那条链全是别名 import。
 *
 * 所有外部依赖（鉴权、选服务商、连上游、写日志）都注入，这个文件本身只有机制，
 * 因此能在 `npm run test:core` 里用假上游跑真 socket。
 *
 * 三条不能违反的：
 *  1. **二进制标志跟着原帧走。** PCM 帧变成文本帧，设备就播不出声。
 *  2. **不缓冲。** 收到即转。调用方打断时直接断连丢音频，中间攒包会拖慢打断。
 *  3. **先连上游再完成客户端握手。** 百炼拒握手（401 之类）要变成客户端握手阶段的
 *     HTTP 错误，而不是「连上了又立刻被关」——后者调用方根本看不出原因。
 */

export type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

export interface BridgeToken {
  id: string;
  name: string;
  prefix: string;
}

export type BridgeAuthResult =
  | { ok: true; token: BridgeToken }
  | { ok: false; code: string; message: string };

export interface BridgeProvider {
  id: string;
  apiKey: string;
  workspaceId: string | null;
}

export interface BridgeLogFields {
  ts: number;
  providerId: string | null;
  modelId: string | null;
  token: BridgeToken;
  source: string | null;
  /** 握手结果：101 表示桥接成功建立，其它就是在握手阶段被拒。 */
  status: number;
  /** 到上游握手完成的耗时。 */
  latencyMs: number;
  /** 上游第一个二进制帧（音频）到达的耗时。 */
  firstTokenMs: number | null;
  /** 连接总时长。 */
  durationMs: number;
  error: string | null;
  clientBytes: number;
  upstreamBytes: number;
}

export interface BridgeDeps {
  authenticate: (bearer: string) => BridgeAuthResult;
  spendLimit: (token: BridgeToken) => { exceeded: boolean; message?: string };
  pickProvider: () => BridgeProvider | null;
  log: (fields: BridgeLogFields) => void;
  /** 缺省直连百炼公共域名；测试注入假上游。 */
  upstreamUrl?: (pathname: string, search: string) => string;
  connectUpstream?: (url: string, headers: Record<string, string>) => WebSocket;
  /** 上游握手上限，默认 10s。 */
  upstreamOpenTimeoutMs?: number;
  now?: () => number;
}

const STATUS_TEXT: Record<number, string> = {
  401: 'Unauthorized',
  404: 'Not Found',
  429: 'Too Many Requests',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/**
 * 握手还没完成时，只能在裸 socket 上手写一个 HTTP 响应。
 *
 * 用 `end()` 而不是 `write()` + `destroy()`：后者会在数据还没冲到内核时就把
 * socket 掐断，客户端收不到完整响应体、永远等不到 end——同步拒绝时碰巧赢得了
 * 这场竞争，延迟拒绝（上游握手超时）时必输。
 */
export function rejectUpgrade(socket: Duplex, status: number, code: string, message: string): void {
  const body = JSON.stringify({ code, message });
  const text = STATUS_TEXT[status] ?? 'Error';
  try {
    socket.end(
      `HTTP/1.1 ${status} ${text}\r\n` +
        'Content-Type: application/json; charset=utf-8\r\n' +
        `Content-Length: ${Buffer.byteLength(body)}\r\n` +
        'Connection: close\r\n\r\n' +
        body,
    );
  } catch {
    // 对方可能已经走了。
    socket.destroy();
    return;
  }
  // 对端不收 FIN 就一直挂着也不行，兜一个底。
  const guard = setTimeout(() => socket.destroy(), 1_000);
  guard.unref();
  socket.once('close', () => clearTimeout(guard));
}

function parseBearer(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return '';
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : '';
}

/**
 * ws 对 close(code) 有校验：1000、1001–1014（除 1004/1005/1006）、3000–4999 才能发。
 * 对端给的码不在范围内（比如 1005「没带码」、1006「异常断开」）就换成等价的。
 */
export function relayCloseCode(code: number | undefined): number {
  if (code === undefined || code === 1005) return 1000;
  if (code === 1004 || code === 1006 || code === 1015) return 1011;
  if ((code >= 1000 && code <= 1014) || (code >= 3000 && code <= 4999)) return code;
  return 1011;
}

/** 从协议 A 的第一条文本帧（run-task）里取 payload.model，只为记账。 */
function peekModel(data: RawData): string | null {
  const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.byteLength > 64 * 1024) return null;
  try {
    const parsed = JSON.parse(buf.toString('utf8'));
    const model = parsed?.payload?.model;
    return typeof model === 'string' && model.trim() ? model.trim() : null;
  } catch {
    return null;
  }
}

function byteLength(data: RawData): number {
  if (Array.isArray(data)) return data.reduce((n, b) => n + b.byteLength, 0);
  return data.byteLength;
}

export function createDashScopeUpgradeHandler(deps: BridgeDeps): UpgradeHandler {
  const now = deps.now ?? Date.now;
  const openTimeoutMs = deps.upstreamOpenTimeoutMs ?? 10_000;
  const toUpstreamUrl = deps.upstreamUrl ?? upstreamWsUrl;
  const connect =
    deps.connectUpstream ??
    ((url: string, headers: Record<string, string>) => new WebSocket(url, { headers, perMessageDeflate: false }));
  // 压缩关掉：音频帧压不动，还会引入攒包。
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  return function onUpgrade(req, socket, head) {
    const startedAt = now();
    socket.on('error', () => {
      // 握手前后的 socket 错误都不该让进程崩。
    });

    const url = new URL(req.url ?? '/', 'http://gateway.invalid');
    const route = matchPassthroughRoute('WS', url.pathname);
    if (!route) {
      rejectUpgrade(socket, 404, 'not_found', `路径 ${url.pathname} 不在 WebSocket 透传白名单内`);
      return;
    }

    const auth = deps.authenticate(parseBearer(req.headers.authorization));
    if (!auth.ok) {
      rejectUpgrade(socket, 401, auth.code, auth.message);
      return;
    }
    const token = auth.token;
    const source = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const logOnce = (() => {
      let done = false;
      return (fields: Omit<BridgeLogFields, 'ts' | 'token' | 'source'>) => {
        if (done) return;
        done = true;
        try {
          deps.log({ ts: startedAt, token, source, ...fields });
        } catch {
          // 记账失败不能影响转发。
        }
      };
    })();

    const limit = deps.spendLimit(token);
    if (limit.exceeded) {
      rejectUpgrade(socket, 429, 'spend_limit_exceeded', limit.message ?? '令牌已超出花费限额');
      logOnce({ providerId: null, modelId: null, status: 429, latencyMs: now() - startedAt, firstTokenMs: null, durationMs: now() - startedAt, error: limit.message ?? 'spend_limit_exceeded', clientBytes: 0, upstreamBytes: 0 });
      return;
    }

    const provider = deps.pickProvider();
    if (!provider) {
      rejectUpgrade(socket, 503, 'dashscope_provider_missing', '网关未配置百炼服务商');
      return;
    }

    // realtime 协议的 model 在 query 上；协议 A 的在第一条 run-task 里，稍后再看。
    let modelId: string | null = url.searchParams.get('model')?.trim() || null;
    const target = toUpstreamUrl(url.pathname, url.search);
    const headers = outboundHeaders(req.headers, provider.apiKey, provider.workspaceId);

    let upstream: WebSocket;
    try {
      upstream = connect(target, headers);
    } catch (e) {
      const message = `无法建立到百炼的 WebSocket 连接：${e instanceof Error ? e.message : String(e)}`;
      rejectUpgrade(socket, 502, 'upstream_unreachable', message);
      logOnce({ providerId: provider.id, modelId, status: 502, latencyMs: now() - startedAt, firstTokenMs: null, durationMs: now() - startedAt, error: message, clientBytes: 0, upstreamBytes: 0 });
      return;
    }

    let settled = false;
    const failHandshake = (status: number, code: string, message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(openTimer);
      try {
        upstream.terminate();
      } catch {
        // 关不上无所谓。
      }
      rejectUpgrade(socket, status, code, message);
      logOnce({ providerId: provider.id, modelId, status, latencyMs: now() - startedAt, firstTokenMs: null, durationMs: now() - startedAt, error: message, clientBytes: 0, upstreamBytes: 0 });
    };

    const openTimer = setTimeout(
      () => failHandshake(504, 'upstream_timeout', `百炼在 ${openTimeoutMs}ms 内没有完成 WebSocket 握手`),
      openTimeoutMs,
    );
    upstream.once('error', (err) => failHandshake(502, 'upstream_error', `百炼 WebSocket 错误：${err.message}`));
    // 上游用普通 HTTP 状态拒绝握手（401/403…）：把它的状态与原话转给客户端。
    upstream.once('unexpected-response', (_req, res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => {
        if (chunks.reduce((n, b) => n + b.byteLength, 0) < 4096) chunks.push(c);
      });
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8').slice(0, 1024);
        failHandshake(res.statusCode ?? 502, 'upstream_rejected', `百炼拒绝了握手 (${res.statusCode})：${text || '（无响应体）'}`);
      });
      res.on('error', () => failHandshake(502, 'upstream_rejected', `百炼拒绝了握手 (${res.statusCode})`));
    });

    upstream.once('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(openTimer);
      const openMs = now() - startedAt;

      wss.handleUpgrade(req, socket, head, (client) => {
        let firstBinaryMs: number | null = null;
        let clientBytes = 0;
        let upstreamBytes = 0;
        let upstreamCloseNote: string | null = null;
        let closedSides = 0;

        const finish = () => {
          closedSides += 1;
          if (closedSides < 2) return;
          logOnce({
            providerId: provider.id,
            modelId,
            status: 101,
            latencyMs: openMs,
            firstTokenMs: firstBinaryMs,
            durationMs: now() - startedAt,
            error: upstreamCloseNote,
            clientBytes,
            upstreamBytes,
          });
        };

        const closeOther = (other: WebSocket, code: number | undefined, reason: Buffer | string) => {
          if (other.readyState === WebSocket.OPEN || other.readyState === WebSocket.CONNECTING) {
            const text = Buffer.isBuffer(reason) ? reason.toString('utf8') : reason;
            try {
              other.close(relayCloseCode(code), Buffer.byteLength(text) > 123 ? '' : text);
            } catch {
              other.terminate();
            }
          }
        };

        client.on('message', (data, isBinary) => {
          clientBytes += byteLength(data);
          if (!isBinary && modelId === null) modelId = peekModel(data);
          if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
        });
        upstream.on('message', (data, isBinary) => {
          upstreamBytes += byteLength(data);
          if (isBinary && firstBinaryMs === null) firstBinaryMs = now() - startedAt;
          if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
        });

        client.on('close', (code, reason) => {
          closeOther(upstream, code, reason);
          finish();
        });
        upstream.on('close', (code, reason) => {
          if (code !== 1000 && code !== 1005) {
            upstreamCloseNote = `上游关闭 ${code}${reason?.length ? ` ${reason.toString('utf8').slice(0, 200)}` : ''}`;
          }
          closeOther(client, code, reason);
          finish();
        });
        client.on('error', () => closeOther(upstream, 1011, 'client error'));
        upstream.on('error', (err) => {
          upstreamCloseNote = `上游错误：${err.message}`;
          closeOther(client, 1011, 'upstream error');
        });
      });
    });
  };
}
