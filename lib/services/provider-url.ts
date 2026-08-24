/** Shared SSRF-safe URL validation for provider compatibility projections and endpoint sets. */
export function validateProviderBaseUrl(baseUrl: string, allowHttpProviders = false): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return 'base_url 不是合法 URL';
  }
  if (url.protocol === 'https:') return null;
  const host = url.hostname;
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (url.protocol === 'http:' && (isLoopback || allowHttpProviders)) return null;
  return 'base_url 必须使用 https 协议（仅 localhost 允许 http，或在设置中开启 allow_http_providers）';
}
