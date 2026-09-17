import { serializeEndpoint, type ProviderEndpoint } from './provider-endpoint.ts';

export interface ProviderSerializationSource {
  id: string;
  slug: string;
  name: string;
  protocol: string;
  baseUrl: string;
  presetKey: string | null;
  apiKeyEnc: string;
  enabled: number;
  priority: number;
  workspaceId?: string | null;
  balanceConfig: string | null;
  remark: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

/** Public provider shape: endpoint data is included, while encrypted API keys remain internal. */
export function serializeProviderRecord(provider: ProviderSerializationSource, endpoints: ProviderEndpoint[], subscriptionAccountId: string | null = null) {
  const defaultEndpoint = endpoints.find((endpoint) => endpoint.enabled && endpoint.isDefault);
  return {
    id: provider.id,
    auth_kind: subscriptionAccountId ? 'subscription' as const : 'api_key' as const,
    subscription_account_id: subscriptionAccountId,
    slug: provider.slug,
    name: provider.name,
    preset_key: provider.presetKey,
    default_protocol: defaultEndpoint?.protocol ?? provider.protocol,
    default_base_url: defaultEndpoint?.baseUrl ?? provider.baseUrl,
    protocol: defaultEndpoint?.protocol ?? provider.protocol,
    base_url: defaultEndpoint?.baseUrl ?? provider.baseUrl,
    endpoints: endpoints.map(serializeEndpoint),
    enabled: provider.enabled === 1,
    priority: provider.priority,
    workspace_id: provider.workspaceId ?? null,
    balance_config: provider.balanceConfig,
    remark: provider.remark,
    has_key: !subscriptionAccountId && !!provider.apiKeyEnc,
    created_at: provider.createdAt,
    updated_at: provider.updatedAt,
  };
}
