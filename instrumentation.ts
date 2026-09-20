/**
 * Next.js instrumentation：进程启动钩子（register 在 nodejs runtime 各进程执行一次）。
 *
 * 修复 Homebrew node@22（shared OpenSSL）系统 CA 存储损坏导致的
 * "self-signed certificate in certificate chain" 问题：显式用 Node 内置的
 * Mozilla CA 列表（tls.rootCertificates）作为 undici 全局 dispatcher 的 CA，
 * 覆盖网关转发、测速、余额查询、模型同步等全部出站 fetch。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const tls = await import('node:tls');
    const { Agent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new Agent({ connect: { ca: [...tls.rootCertificates] } }));

    /**
     * 百炼 WebSocket 透传的桥接处理器发布到 globalThis，由 server.mts 在
     * http.Server 的 'upgrade' 事件里取用。放这里而不是 server.mts 里 import，
     * 是因为桥接的依赖链（鉴权、解密、日志）全是 `@/` 别名，只有 Next 打包的
     * 代码才解析得了。
     */
    const { createProductionUpgradeHandler } = await import('@/lib/passthrough/dashscope-ws');
    globalThis.__modelCenterUpgrade = createProductionUpgradeHandler();
  }
}
