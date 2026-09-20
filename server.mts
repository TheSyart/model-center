/**
 * 自定义服务器：在 Next 的同一个端口上接管 WebSocket 的 Upgrade。
 *
 * 为什么需要它：Next 的路由处理器永远看不见 `Upgrade` 请求——它在 Node 层就分流成
 * http.Server 的 'upgrade' 事件了。而 Next 自带的 upgrade 处理器对不匹配任何路由的
 * 路径**既不响应也不关闭**（router-server.js 原话："user's custom WS server may be
 * listening on the same path"），这就是「带 Upgrade 头会挂住不响应」的根因。
 * 百炼透传的 `/api-ws/v1/*` 要接进来，只能在这里挂自己的监听器。
 *
 * 这个文件在 Next 之外，用不了 `@/` 别名，所以**不含任何业务逻辑**：桥接处理器由
 * instrumentation.ts 发布到 globalThis，这里只转交。只 import `node:*` 与 `next`。
 *
 * 启动顺序照 Next 生成的 standalone server.js（build/utils.js 的模板）复刻，
 * 并按 Next 15.5 源码逐条核对过（见 docs/vendor-apis/bailian.md「原生透传」一节）：
 *  - NODE_ENV 必须在 import next 之前定下，且 next 只能动态 import——静态 import
 *    会被提升到赋值之前；
 *  - 生产下 __NEXT_PRIVATE_STANDALONE_CONFIG 是必需的，没有它 loadConfig 会崩，
 *    而 next() 的 conf 选项在自定义服务器这条路上是空操作；
 *  - 生产下 instrumentation 的 register() 不被 app.prepare() 等待，要自己等就绪；
 *  - 不要自己调 app.getUpgradeHandler()：Next 会在首个请求时把自己的监听器挂到同一个
 *    server 上处理 HMR，再调一次就是对同一个 socket 跑两遍握手。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import { parseArgs } from 'node:util';

const dir = import.meta.dirname;
process.chdir(dir);

const { values } = parseArgs({
  options: { hostname: { type: 'string' }, port: { type: 'string' } },
  strict: false,
});
const hostname = (typeof values.hostname === 'string' && values.hostname) || process.env.HOSTNAME || '0.0.0.0';
const port = Number((typeof values.port === 'string' && values.port) || process.env.PORT || 3000);
process.env.PORT = String(port);

// Next 把 NODE_ENV 声明成只读，这里是唯一该赋值的地方（在 import next 之前）。
const env = process.env as Record<string, string | undefined>;
env.NODE_ENV ??= 'development';
const dev = env.NODE_ENV !== 'production';

if (!dev) {
  // 与 next.config.ts 同一个约定；standalone 目录里没有 next.config.ts 可读。
  const distDir = process.env.MODEL_CENTER_NEXT_DIST_DIR || '.next';
  const requiredServerFiles = path.join(dir, distDir, 'required-server-files.json');
  const { config } = JSON.parse(fs.readFileSync(requiredServerFiles, 'utf8')) as { config: unknown };
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
}

const next = (await import('next')).default;
const app = next({ dev, dir, hostname, port });
await app.prepare();
const handle = app.getRequestHandler();

/** 握手前只能在裸 socket 上手写响应；用 end() 让数据冲完再 FIN。 */
function rejectUpgrade(socket: Duplex, status: number, text: string): void {
  try {
    socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  } catch {
    socket.destroy();
  }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    console.error('请求处理失败', err);
    if (!res.headersSent) res.statusCode = 500;
    res.end('Internal Server Error');
  });
});

// prepend：Next 会在首个 HTTP 请求时把自己的监听器 .on 到这个 server 上，我们要先跑。
server.prependListener('upgrade', (req, socket, head) => {
  const url = req.url ?? '';
  socket.on('error', () => {
    // 对端随时可能走人，不能让它把进程带崩。
  });

  if (url.startsWith('/api-ws/')) {
    const bridge = globalThis.__modelCenterUpgrade;
    if (!bridge) {
      rejectUpgrade(socket, 503, 'Service Unavailable');
      return;
    }
    try {
      bridge(req, socket, head);
    } catch (err) {
      console.error('WebSocket 桥接失败', err);
      socket.destroy();
    }
    return;
  }

  // dev 的 HMR 交给 Next 自己挂的监听器，这里什么都不做。
  if (dev && url.startsWith('/_next/webpack-hmr')) return;

  // 其余路径：此前会挂住不响应，现在立即 404。
  rejectUpgrade(socket, 404, 'Not Found');
});

const keepAliveTimeout = Number.parseInt(process.env.KEEP_ALIVE_TIMEOUT ?? '', 10);
if (Number.isFinite(keepAliveTimeout) && keepAliveTimeout >= 0) {
  server.keepAliveTimeout = keepAliveTimeout;
}

server.on('error', (err) => {
  console.error('监听失败', err);
  process.exit(1);
});

/**
 * 生产下 register() 由 NextNodeServer 的构造函数 fire-and-forget 触发，
 * app.prepare() 不等它。桥接没就绪就开门，这个窗口里的 WebSocket 会拿到 503。
 * dev 下 prepare() 已经 await 过 register()，这里立刻返回。
 */
async function waitForBridge(timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (!globalThis.__modelCenterUpgrade) {
    if (Date.now() - started > timeoutMs) {
      console.warn(`WebSocket 桥接在 ${timeoutMs}ms 内未就绪，先开 HTTP；/api-ws/ 在就绪前回 503`);
      return;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}
await waitForBridge(10_000);

server.listen(port, hostname, () => {
  console.log(`model-center 已启动 http://${hostname}:${port}（${dev ? 'dev' : 'production'}，WebSocket 桥接${globalThis.__modelCenterUpgrade ? '已就绪' : '未就绪'}）`);
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`收到 ${signal}，开始退出`);
  // 先停收新连接并排空在途请求，再让 Next 收尾；Docker stop 才不会砍到一半。
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try {
    await app.close();
  } catch (err) {
    console.error('Next 收尾失败', err);
  }
  process.exit(0);
}
if (!process.env.NEXT_MANUAL_SIG_HANDLE) {
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
