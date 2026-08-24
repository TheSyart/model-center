export interface EndpointAttemptProjection {
  id: string;
  protocol: string;
  baseUrl: string;
}

/** Keeps the existing adapter contract while projecting one selected endpoint. */
export function providerForEndpoint<T extends { protocol: string; baseUrl: string }>(
  provider: T,
  endpoint: EndpointAttemptProjection,
): T & { protocol: typeof endpoint.protocol; baseUrl: typeof endpoint.baseUrl } {
  return { ...provider, protocol: endpoint.protocol, baseUrl: endpoint.baseUrl };
}

export function isNativeEndpoint(entry: 'openai' | 'responses' | 'anthropic', endpointProtocol: string): boolean {
  return (entry === 'openai' && endpointProtocol === 'openai') ||
    (entry === 'responses' && endpointProtocol === 'openai-responses') ||
    (entry === 'anthropic' && endpointProtocol === 'anthropic');
}

/** Ordinary 4xx responses are client errors, never endpoint-retry signals. */
export function shouldFailoverStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

