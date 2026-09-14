import { ProxyAgent } from 'undici';
import { rootCertificates } from 'node:tls';

let cached: { url: string; agent: ProxyAgent } | undefined;

/** Server-configured egress for subscription traffic only. Keep TLS verification
 * and the bundled CA roots used by the application's default dispatcher. */
export const subscriptionFetch: typeof fetch = async (input, init) => {
  const configured = process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL?.trim();
  if (!configured) return globalThis.fetch(input, init);
  if (cached?.url !== configured) {
    let url: URL;
    try {
      url = new URL(configured);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname ||
          url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new Error();
      }
    } catch {
      throw new Error('MODEL_CENTER_SUBSCRIPTION_PROXY_URL 必须是无认证信息和路径的 HTTP(S) 代理地址');
    }
    const agent = new ProxyAgent({
      uri: url.origin,
      requestTls: { ca: [...rootCertificates] },
      proxyTls: { ca: [...rootCertificates] },
    });
    const old = cached;
    cached = { url: configured, agent };
    void old?.agent.close().catch(() => {});
  }
  // Node's native fetch supports undici dispatchers; DOM RequestInit omits it.
  const options: RequestInit & { dispatcher: ProxyAgent } = {
    ...init,
    dispatcher: cached.agent,
  };
  return globalThis.fetch(input, options);
};
