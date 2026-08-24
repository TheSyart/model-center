import { getAdapter } from '@/lib/adapters';
import type { AdapterContext, ProtocolAdapter } from '@/lib/adapters/types';
import { decrypt } from '@/lib/crypto';
import { protocolNotImplemented } from './errors';
import type { RouteTarget } from './router';
import { isNativeEndpoint, providerForEndpoint, shouldFailoverStatus } from './endpoint-attempt-context';
import type { ProviderProtocol } from '@/lib/presets/types';

type Json = Record<string, any>;

export type GatewayEntryProtocol = 'openai' | 'anthropic' | 'responses';

export interface AttemptInput {
  entry: GatewayEntryProtocol;
  rawBody: Json;
  ir: Json;
  requestedModel: string;
  stream: boolean;
  includeUsage: boolean;
  anthropicVersion?: string | null;
}

export interface AttemptContext {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  adapter: ProtocolAdapter | undefined;
  ctx: AdapterContext;
  passthrough: boolean;
  endpoint: SelectedProviderEndpoint;
}

export interface SelectedProviderEndpoint {
  id: string;
  protocol: ProviderProtocol;
  baseUrl: string;
}

/** Alias failover permits only transient/network-like upstream failures. */
export { shouldFailoverStatus } from './endpoint-attempt-context';

function passthroughRequest(
  entry: GatewayEntryProtocol,
  base: string,
  apiKey: string,
  rawBody: Json,
  modelId: string,
  anthropicVersion: string | null | undefined,
): { url: string; headers: Record<string, string>; body: Json } {
  if (entry === 'anthropic') {
    return {
      url: `${base}/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': anthropicVersion ?? '2023-06-01',
      },
      body: { ...rawBody, model: modelId },
    };
  }
  return {
    url: entry === 'responses' ? `${base}/responses` : `${base}/chat/completions`,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: { ...rawBody, model: modelId },
  };
}

/** Builds one selected endpoint attempt; endpoint fallback is decided before calling this function. */
export function buildAttemptForEndpoint(input: AttemptInput, target: RouteTarget, endpoint: SelectedProviderEndpoint): AttemptContext {
  const provider = providerForEndpoint(target.provider, endpoint);
  const apiKey = decrypt(provider.apiKeyEnc);
  const base = provider.baseUrl.replace(/\/+$/, '');
  const ctx: AdapterContext = {
    provider,
    apiKey,
    modelId: target.modelId,
    stream: input.stream,
    includeUsage: input.includeUsage,
  };
  const passthrough = isNativeEndpoint(input.entry, provider.protocol);
  if (passthrough) {
    const built = passthroughRequest(input.entry, base, apiKey, input.rawBody, target.modelId, input.anthropicVersion);
    return { ...built, adapter: undefined, ctx, passthrough: true, endpoint };
  }
  const adapter = getAdapter(provider.protocol);
  if (!adapter) throw protocolNotImplemented(provider.protocol);
  const built = adapter.buildRequest(input.ir, ctx);
  return { url: built.url, headers: built.headers, body: built.body, adapter, ctx, passthrough: false, endpoint };
}
