import type { UpgradeHandler } from '../lib/passthrough/ws-bridge';

declare global {
  /**
   * 百炼 WebSocket 透传的 upgrade 处理器。
   *
   * 由 instrumentation.ts 在 Next 启动时发布，server.mts 在 http.Server 的
   * 'upgrade' 事件里取用。走 globalThis 是因为 server.mts 在 Next 之外，
   * 用不了 `@/` 别名，而桥接的依赖链全是别名 import。
   */
  // eslint-disable-next-line no-var
  var __modelCenterUpgrade: UpgradeHandler | undefined;
}

export {};
