import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createDashScopeUpgradeHandler,
  relayCloseCode,
  type BridgeDeps,
  type BridgeLogFields,
} from '../lib/passthrough/ws-bridge.ts';

/** 假上游：记下每次握手看到的 url 与请求头，缺省把收到的帧原样回显（二进制标志跟着走）。 */
async function fakeUpstream(options: { refuse?: boolean } = {}) {
  const seen: Array<{ url: string; headers: http.IncomingHttpHeaders }> = [];
  const sockets: WebSocket[] = [];
  const wss = new WebSocketServer({
    port: 0,
    host: '127.0.0.1',
    perMessageDeflate: false,
    verifyClient: options.refuse ? () => false : undefined,
  });
  await once(wss, 'listening');
  wss.on('connection', (ws, req) => {
    seen.push({ url: req.url ?? '', headers: req.headers });
    sockets.push(ws);
    ws.on('message', (data, isBinary) => ws.send(data, { binary: isBinary }));
  });
  const port = (wss.address() as net.AddressInfo).port;
  return {
    port,
    seen,
    sockets,
    close: () => new Promise<void>((r) => wss.close(() => r())),
  };
}

/**
 * 一个 TCP 服务，接受连接后什么都不回——模拟上游握手挂住。
 * 关闭时要主动 destroy 攥着的连接：net.Server.close() 会等所有连接结束，
 * 而它自己永远不会结束。
 */
async function silentUpstream() {
  const held: net.Socket[] = [];
  const server = net.createServer((socket) => {
    held.push(socket);
    socket.on('error', () => {});
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return {
    port: (server.address() as net.AddressInfo).port,
    close: () => {
      for (const socket of held) socket.destroy();
      return new Promise<void>((r) => server.close(() => r()));
    },
  };
}

async function gateway(upstreamPort: number, overrides: Partial<BridgeDeps> = {}) {
  const logs: BridgeLogFields[] = [];
  const handler = createDashScopeUpgradeHandler({
    authenticate: (bearer) =>
      bearer === 'good-key'
        ? { ok: true, token: { id: 't1', name: '测试令牌', prefix: 'good-key'.slice(0, 4) } }
        : { ok: false, code: 'invalid_api_key', message: '无效令牌' },
    spendLimit: () => ({ exceeded: false }),
    pickProvider: () => ({ id: 'p-bailian', apiKey: 'sk-upstream', workspaceId: 'llm-ws' }),
    log: (f) => logs.push(f),
    upstreamUrl: (pathname, search) => `ws://127.0.0.1:${upstreamPort}${pathname}${search}`,
    upstreamOpenTimeoutMs: 400,
    ...overrides,
  });
  const server = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  server.on('upgrade', handler);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as net.AddressInfo).port;
  return { port, logs, close: () => new Promise<void>((r) => server.close(() => r())) };
}

/** 连网关；握手成功 status=101，被拒则拿到 HTTP 状态码。 */
function connect(port: number, path: string, headers: Record<string, string> = {}): Promise<{ ws: WebSocket; status: number; body: string }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, { headers, perMessageDeflate: false });
    ws.once('open', () => resolve({ ws, status: 101, body: '' }));
    ws.once('unexpected-response', (_req, res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ ws, status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    ws.once('error', () => {
      // unexpected-response 有监听时 ws 不再抛 error；这里兜底。
    });
  });
}

const AUTH = { authorization: 'Bearer good-key' };

function nextMessage(ws: WebSocket): Promise<{ data: Buffer; isBinary: boolean }> {
  return new Promise((resolve) => ws.once('message', (data, isBinary) => resolve({ data: Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer), isBinary })));
}

test('text and binary frames cross the bridge unchanged, each keeping its own kind', async () => {
  const up = await fakeUpstream();
  const gw = await gateway(up.port);
  try {
    const { ws, status } = await connect(gw.port, '/api-ws/v1/inference', AUTH);
    assert.equal(status, 101);

    ws.send(JSON.stringify({ header: { action: 'run-task' }, payload: { model: 'qwen-audio-3.0-tts-flash' } }));
    const text = await nextMessage(ws);
    assert.equal(text.isBinary, false);
    assert.match(text.data.toString('utf8'), /run-task/);

    // PCM 帧变成文本帧，设备就播不出声——二进制标志必须跟着原帧走。
    const pcm = Buffer.from([0, 1, 2, 3, 254, 255]);
    ws.send(pcm, { binary: true });
    const bin = await nextMessage(ws);
    assert.equal(bin.isBinary, true);
    assert.deepEqual([...bin.data], [...pcm]);

    ws.close(1000, 'done');
    await once(ws, 'close');
  } finally {
    await gw.close();
    await up.close();
  }
});

test('upstream sees the Bailian key, the workspace header and the query, never the gateway key', async () => {
  const up = await fakeUpstream();
  const gw = await gateway(up.port);
  try {
    const { ws, status } = await connect(gw.port, '/api-ws/v1/realtime?model=qwen3-tts-flash-realtime', {
      ...AUTH,
      cookie: 'session=abc',
      'x-dashscope-workspace': 'attacker',
      'user-agent': 'xiaodan/1.0',
    });
    assert.equal(status, 101);
    assert.equal(up.seen.length, 1);
    // realtime 协议的 model 就在 query 上，丢了就是「建连成功却不出音」。
    assert.equal(up.seen[0].url, '/api-ws/v1/realtime?model=qwen3-tts-flash-realtime');
    assert.equal(up.seen[0].headers.authorization, 'Bearer sk-upstream');
    assert.equal(up.seen[0].headers['x-dashscope-workspace'], 'llm-ws');
    assert.equal(up.seen[0].headers.cookie, undefined);
    assert.equal(up.seen[0].headers['user-agent'], 'xiaodan/1.0');
    ws.close();
    await once(ws, 'close');
  } finally {
    await gw.close();
    await up.close();
  }
});

test('a bad gateway key is refused at the handshake and upstream is never contacted', async () => {
  const up = await fakeUpstream();
  const gw = await gateway(up.port);
  try {
    const { status, body } = await connect(gw.port, '/api-ws/v1/inference', { authorization: 'Bearer wrong' });
    assert.equal(status, 401);
    assert.match(body, /invalid_api_key/);
    assert.equal(up.seen.length, 0, '没认出 key 就不该碰上游');
    assert.equal(gw.logs.length, 0, '握手都没过的不记账');
  } finally {
    await gw.close();
    await up.close();
  }
});

test('paths outside the whitelist are refused with 404', async () => {
  const up = await fakeUpstream();
  const gw = await gateway(up.port);
  try {
    const { status } = await connect(gw.port, '/api-ws/v1/somewhere-else', AUTH);
    assert.equal(status, 404);
    assert.equal(up.seen.length, 0);
  } finally {
    await gw.close();
    await up.close();
  }
});

test('an upstream that refuses the handshake surfaces as an HTTP error on the client handshake', async () => {
  // 先连上游再完成客户端握手：百炼拒了要变成客户端握手阶段的 HTTP 错误，
  // 而不是「连上了又立刻被关」——那样调用方根本看不出原因。
  const up = await fakeUpstream({ refuse: true });
  const gw = await gateway(up.port);
  try {
    const { status, body } = await connect(gw.port, '/api-ws/v1/inference', AUTH);
    assert.equal(status, 401);
    assert.match(body, /upstream_rejected/);
    assert.equal(gw.logs.length, 1);
    assert.equal(gw.logs[0].status, 401);
  } finally {
    await gw.close();
    await up.close();
  }
});

test('an upstream that never completes the handshake yields 504 within the open timeout', async () => {
  const up = await silentUpstream();
  const gw = await gateway(up.port);
  try {
    const started = Date.now();
    const { status, body } = await connect(gw.port, '/api-ws/v1/inference', AUTH);
    assert.equal(status, 504);
    assert.match(body, /upstream_timeout/);
    assert.ok(Date.now() - started < 2_000, '要在 openTimeout（400ms）附近就放弃，不能等到天荒地老');
  } finally {
    await gw.close();
    await up.close();
  }
});

test('closing one side closes the other with the same code and reason', async () => {
  const up = await fakeUpstream();
  const gw = await gateway(up.port);
  try {
    // 客户端 → 上游
    const a = await connect(gw.port, '/api-ws/v1/inference', AUTH);
    await new Promise((r) => setTimeout(r, 20));
    const upstreamSideA = up.sockets[0];
    const upstreamClosed = once(upstreamSideA, 'close');
    a.ws.close(4001, 'bye');
    const [codeA, reasonA] = (await upstreamClosed) as [number, Buffer];
    assert.equal(codeA, 4001);
    assert.equal(reasonA.toString('utf8'), 'bye');

    // 上游 → 客户端
    const b = await connect(gw.port, '/api-ws/v1/inference', AUTH);
    await new Promise((r) => setTimeout(r, 20));
    const clientClosed = once(b.ws, 'close');
    up.sockets[1].close(4002, 'upstream gone');
    const [codeB, reasonB] = (await clientClosed) as [number, Buffer];
    assert.equal(codeB, 4002);
    assert.equal(reasonB.toString('utf8'), 'upstream gone');
  } finally {
    await gw.close();
    await up.close();
  }
});

test('one accounting row per connection, with the model and the first audio frame time', async () => {
  const up = await fakeUpstream();
  const gw = await gateway(up.port);
  try {
    const { ws } = await connect(gw.port, '/api-ws/v1/inference', { ...AUTH, 'user-agent': 'xiaodan/1.0' });
    // 协议 A 的 model 在第一条 run-task 里，只为记账看一眼，不改一个字节。
    ws.send(JSON.stringify({ header: { action: 'run-task' }, payload: { model: 'cosyvoice-v3-flash' } }));
    await nextMessage(ws);
    ws.send(Buffer.from([9, 9, 9]), { binary: true });
    await nextMessage(ws);
    ws.close(1000);
    await once(ws, 'close');
    await new Promise((r) => setTimeout(r, 30));

    assert.equal(gw.logs.length, 1, '一条连接只记一行，两侧各自关闭不能记两次');
    const log = gw.logs[0];
    assert.equal(log.status, 101);
    assert.equal(log.modelId, 'cosyvoice-v3-flash');
    assert.equal(log.source, 'xiaodan/1.0');
    assert.equal(typeof log.firstTokenMs, 'number', '上游第一个二进制帧就是首包');
    assert.equal(log.error, null, '正常关闭不算错');
    assert.ok(log.upstreamBytes >= 3);
  } finally {
    await gw.close();
    await up.close();
  }
});

test('an abnormal upstream close is named in the accounting row', async () => {
  const up = await fakeUpstream();
  const gw = await gateway(up.port);
  try {
    const { ws } = await connect(gw.port, '/api-ws/v1/inference', AUTH);
    await new Promise((r) => setTimeout(r, 20));
    const closed = once(ws, 'close');
    up.sockets[0].close(1011, 'engine crashed');
    await closed;
    await new Promise((r) => setTimeout(r, 30));
    assert.match(String(gw.logs[0]?.error), /上游关闭 1011 engine crashed/);
  } finally {
    await gw.close();
    await up.close();
  }
});

test('close codes the ws library refuses to send are mapped, not dropped', () => {
  // ws 只肯发 1000、1001–1014（除 1004/1005/1006）、3000–4999。
  assert.equal(relayCloseCode(1000), 1000);
  assert.equal(relayCloseCode(4001), 4001);
  assert.equal(relayCloseCode(1011), 1011);
  // 对端「没带码」按正常关闭转。
  assert.equal(relayCloseCode(undefined), 1000);
  assert.equal(relayCloseCode(1005), 1000);
  // 异常断开、保留码、超出范围的一律 1011。
  assert.equal(relayCloseCode(1006), 1011);
  assert.equal(relayCloseCode(1015), 1011);
  assert.equal(relayCloseCode(2000), 1011);
  assert.equal(relayCloseCode(5000), 1011);
});
