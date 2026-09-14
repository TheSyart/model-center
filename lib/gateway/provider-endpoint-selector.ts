import type { ProviderProtocol } from '@/lib/presets/types';

export type GatewayEntryProtocol = 'openai' | 'responses' | 'anthropic';

export interface SelectableProviderEndpoint {
  id: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  enabled: boolean;
  isDefault: boolean;
  modelCatalogComplete: boolean;
}

export interface EndpointModelObservation {
  endpointId: string;
  modelId: string;
}

const NATIVE_PROTOCOL: Record<GatewayEntryProtocol, ProviderProtocol> = {
  openai: 'openai',
  responses: 'openai-responses',
  anthropic: 'anthropic',
};

const PROTOCOL_ORDER: ProviderProtocol[] = ['openai', 'openai-responses', 'anthropic', 'gemini'];

function knowsModel(endpoint: SelectableProviderEndpoint, modelId: string, observations: EndpointModelObservation[]): boolean {
  return observations.some((observation) => observation.endpointId === endpoint.id && observation.modelId === modelId);
}

/**
 * An endpoint is incompatible only after its complete catalog confirms that the
 * requested model is absent. An unknown catalog intentionally remains eligible.
 */
function canServe(endpoint: SelectableProviderEndpoint, modelId: string, observations: EndpointModelObservation[]): boolean {
  return endpoint.enabled && (!endpoint.modelCatalogComplete || knowsModel(endpoint, modelId, observations));
}

/**
 * Selects one endpoint for a single provider/model attempt. This deliberately
 * makes no network calls: normal 400/404 responses are never used as a signal
 * to retry another endpoint.
 */
export function selectProviderEndpoint(
  endpoints: SelectableProviderEndpoint[],
  entry: GatewayEntryProtocol,
  modelId: string,
  observations: EndpointModelObservation[],
  /** Chosen first when its complete catalog confirms the model (e.g. Copilot /responses for reasoning). */
  preferredProtocol?: ProviderProtocol,
): SelectableProviderEndpoint | undefined {
  const enabled = endpoints.filter((endpoint) => endpoint.enabled);
  if (preferredProtocol) {
    const preferred = enabled.find(
      (endpoint) => endpoint.protocol === preferredProtocol && endpoint.modelCatalogComplete && knowsModel(endpoint, modelId, observations),
    );
    if (preferred) return preferred;
  }
  const native = enabled.find((endpoint) => endpoint.protocol === NATIVE_PROTOCOL[entry]);
  if (native && canServe(native, modelId, observations)) return native;

  const defaultEndpoint = enabled.find((endpoint) => endpoint.isDefault);
  if (defaultEndpoint && canServe(defaultEndpoint, modelId, observations)) return defaultEndpoint;

  const knownCompatible = enabled.find((endpoint) => knowsModel(endpoint, modelId, observations));
  if (knownCompatible) return knownCompatible;

  return PROTOCOL_ORDER
    .map((protocol) => enabled.find((endpoint) => endpoint.protocol === protocol && canServe(endpoint, modelId, observations)))
    .find((endpoint): endpoint is SelectableProviderEndpoint => !!endpoint);
}
