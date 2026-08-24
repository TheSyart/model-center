import type { ProviderPreset, ProviderProtocol } from '../presets/types.ts';

export const FORM_ENDPOINT_PROTOCOLS: ProviderProtocol[] = ['openai', 'openai-responses', 'anthropic', 'gemini'];

export interface ProviderFormEndpoint {
  protocol: ProviderProtocol;
  base_url: string;
  enabled: boolean;
  is_default: boolean;
}

export function protocolDisplayName(protocol: ProviderProtocol): string {
  return {
    openai: 'Chat',
    'openai-responses': 'Responses',
    anthropic: 'Messages',
    gemini: 'Gemini',
  }[protocol];
}

export function filterProviderPresets<T extends Pick<ProviderPreset, 'presetKey' | 'slug' | 'name' | 'recommended' | 'legacySlugs'>>(
  presets: T[],
  query: string,
): T[] {
  const needle = query.trim().toLocaleLowerCase('zh-CN');
  return [...presets]
    .filter((preset) => !needle || [preset.name, preset.slug, preset.presetKey, ...preset.legacySlugs]
      .some((value) => value.toLocaleLowerCase('zh-CN').includes(needle)))
    .sort((left, right) => {
      const recommended = Number(Boolean(right.recommended)) - Number(Boolean(left.recommended));
      return recommended || left.name.localeCompare(right.name, 'zh-CN') || left.presetKey.localeCompare(right.presetKey);
    });
}

export function createCustomFormEndpoints(): ProviderFormEndpoint[] {
  return [{ protocol: 'openai', base_url: '', enabled: true, is_default: true }];
}

function normalizeDefault(endpoints: ProviderFormEndpoint[], defaultProtocol?: ProviderProtocol): ProviderFormEndpoint[] {
  const desired = defaultProtocol && endpoints.find((endpoint) => endpoint.protocol === defaultProtocol && endpoint.enabled)
    ? defaultProtocol
    : endpoints.find((endpoint) => endpoint.is_default && endpoint.enabled)?.protocol ?? endpoints.find((endpoint) => endpoint.enabled)?.protocol;
  return endpoints.map((endpoint) => ({ ...endpoint, is_default: endpoint.protocol === desired }));
}

export function validateFormEndpoints(endpoints: ProviderFormEndpoint[]): ProviderFormEndpoint[] {
  if (endpoints.length < 1) throw new Error('至少需要保留一个端点');
  if (endpoints.length > 4) throw new Error('最多只能配置 4 个端点');
  const protocols = new Set<ProviderProtocol>();
  for (const endpoint of endpoints) {
    if (!FORM_ENDPOINT_PROTOCOLS.includes(endpoint.protocol)) throw new Error('不支持的端点协议');
    if (protocols.has(endpoint.protocol)) throw new Error('端点协议不能重复');
    protocols.add(endpoint.protocol);
  }
  if (!endpoints.some((endpoint) => endpoint.enabled)) throw new Error('至少需要一个启用的端点');
  const normalized = normalizeDefault(endpoints);
  if (normalized.filter((endpoint) => endpoint.is_default).length !== 1) throw new Error('必须且只能指定一个默认端点');
  return normalized;
}

export function addFormEndpoint(endpoints: ProviderFormEndpoint[], protocol: ProviderProtocol): ProviderFormEndpoint[] {
  if (endpoints.length >= 4) throw new Error('最多只能配置 4 个端点');
  if (endpoints.some((endpoint) => endpoint.protocol === protocol)) throw new Error('端点协议不能重复');
  return validateFormEndpoints([...endpoints, { protocol, base_url: '', enabled: true, is_default: false }]);
}

export function removeFormEndpoint(endpoints: ProviderFormEndpoint[], protocol: ProviderProtocol): ProviderFormEndpoint[] {
  const next = endpoints.filter((endpoint) => endpoint.protocol !== protocol);
  if (next.length === endpoints.length) return validateFormEndpoints(endpoints);
  return validateFormEndpoints(next);
}

export function setFormDefaultProtocol(endpoints: ProviderFormEndpoint[], protocol: ProviderProtocol): ProviderFormEndpoint[] {
  const target = endpoints.find((endpoint) => endpoint.protocol === protocol);
  if (!target) throw new Error('端点不存在');
  if (!target.enabled) throw new Error('默认端点必须启用');
  return validateFormEndpoints(endpoints.map((endpoint) => ({ ...endpoint, is_default: endpoint.protocol === protocol })));
}

export function setFormEndpointEnabled(endpoints: ProviderFormEndpoint[], protocol: ProviderProtocol, enabled: boolean): ProviderFormEndpoint[] {
  return validateFormEndpoints(endpoints.map((endpoint) => endpoint.protocol === protocol ? { ...endpoint, enabled } : endpoint));
}
