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
  }
}
