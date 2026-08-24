import type { ProviderPreset, ProviderProtocol } from '../presets/types.ts';
import {
  ENDPOINT_PROTOCOLS,
  EndpointValidationError,
  materializePresetEndpoints,
  type EndpointInput,
  type ProviderEndpoint,
  validateCompleteEndpointSet,
} from './provider-endpoint.ts';

export interface EndpointRequestBody {
  preset_key?: unknown;
  endpoints?: unknown;
  default_protocol?: unknown;
  protocol?: unknown;
  base_url?: unknown;
}

type PresetLookup = (presetKey: string) => ProviderPreset | undefined;
type UrlValidator = (baseUrl: string) => string | null;

function reject(message: string): never {
  throw new EndpointValidationError(message);
}

function presetFor(body: EndpointRequestBody, getPreset: PresetLookup): ProviderPreset | undefined {
  if (body.preset_key === undefined || body.preset_key === null) return undefined;
  if (typeof body.preset_key !== 'string' || !body.preset_key.trim()) reject('preset_key 不能为空');
  const preset = getPreset(body.preset_key.trim());
  if (!preset || preset.supported === false) reject('预设不支持或不存在');
  return preset;
}

function rawEndpoints(value: unknown): EndpointInput[] {
  if (!Array.isArray(value)) reject('endpoints 必须是数组');
  return value.map((endpoint) => {
    if (!endpoint || typeof endpoint !== 'object') reject('endpoint 必须是对象');
    const value = endpoint as Record<string, unknown>;
    if (typeof value.protocol !== 'string') reject('endpoint protocol 必须是字符串');
    if (typeof value.base_url !== 'string') reject('endpoint base_url 必须是字符串');
    if (value.enabled !== undefined && typeof value.enabled !== 'boolean') reject('endpoint enabled 必须是 boolean');
    if (value.is_default !== undefined && typeof value.is_default !== 'boolean') reject('endpoint is_default 必须是 boolean');
    return {
      protocol: value.protocol as ProviderProtocol,
      base_url: value.base_url,
      enabled: value.enabled,
      is_default: value.is_default,
    };
  });
}

function applyDefaultProtocol(endpoints: EndpointInput[], defaultProtocol: unknown, replaceExistingDefault = false): EndpointInput[] {
  if (defaultProtocol === undefined) return endpoints;
  if (typeof defaultProtocol !== 'string' || !(ENDPOINT_PROTOCOLS as readonly string[]).includes(defaultProtocol)) {
    reject(`default_protocol 必须是 ${ENDPOINT_PROTOCOLS.join(' / ')}`);
  }
  if (!endpoints.some((endpoint) => endpoint.protocol === defaultProtocol)) reject('default_protocol 必须存在于 endpoints');
  if (!replaceExistingDefault && endpoints.some((endpoint) => endpoint.is_default === true && endpoint.protocol !== defaultProtocol)) {
    reject('default_protocol 与 endpoints 的默认端点冲突');
  }
  return endpoints.map((endpoint) => ({ ...endpoint, is_default: endpoint.protocol === defaultProtocol }));
}

function addPresetKnowledge(endpoints: EndpointInput[], preset: ProviderPreset | undefined): EndpointInput[] {
  if (!preset) return endpoints;
  const presetByProtocol = new Map(preset.endpoints.map((endpoint) => [endpoint.protocol, endpoint]));
  return endpoints.map((endpoint) => {
    const source = presetByProtocol.get(endpoint.protocol);
    if (!source) return endpoint;
    return {
      ...endpoint,
      preset_variant_slug: source.selectedVariantSlug,
      source_ref: preset.presetKey,
      models: source.knownModels
        .filter((model) => model.id.trim().length > 0)
        .map((model) => ({ model_id: model.id, source: 'preset' as const })),
    };
  });
}

function materializePresetEndpointsForPatch(preset: ProviderPreset): EndpointInput[] {
  return materializePresetEndpoints(preset).map(({ model_catalog_complete: _catalogComplete, ...endpoint }) => endpoint);
}

/** Resolve POST's preset, new multi-endpoint, and legacy protocol/base_url shapes into one complete set. */
export function resolveEndpointSetForCreate(
  body: EndpointRequestBody,
  getPreset: PresetLookup,
  validateUrl?: UrlValidator,
): EndpointInput[] {
  const preset = presetFor(body, getPreset);
  let endpoints: EndpointInput[];
  if (body.endpoints !== undefined) {
    endpoints = addPresetKnowledge(rawEndpoints(body.endpoints), preset);
  } else if (preset) {
    endpoints = materializePresetEndpoints(preset);
  } else {
    if (body.protocol === undefined || body.base_url === undefined) reject('protocol、base_url 不能为空');
    endpoints = [{ protocol: body.protocol as ProviderProtocol, base_url: body.base_url as string, enabled: true, is_default: true }];
  }
  return validateCompleteEndpointSet(applyDefaultProtocol(endpoints, body.default_protocol), validateUrl);
}

/** Resolve PATCH's complete set, optional preset materialization, or a legacy update to the current default endpoint. */
export function resolveEndpointSetForPatch(
  body: EndpointRequestBody,
  current: ProviderEndpoint[],
  getPreset: PresetLookup,
  validateUrl?: UrlValidator,
): EndpointInput[] | undefined {
  const preset = presetFor(body, getPreset);
  if (body.endpoints !== undefined) {
    return validateCompleteEndpointSet(applyDefaultProtocol(addPresetKnowledge(rawEndpoints(body.endpoints), preset), body.default_protocol), validateUrl);
  }
  if (preset) {
    return validateCompleteEndpointSet(applyDefaultProtocol(materializePresetEndpointsForPatch(preset), body.default_protocol), validateUrl);
  }
  if (body.protocol === undefined && body.base_url === undefined && body.default_protocol === undefined) return undefined;
  const currentDefault = current.find((endpoint) => endpoint.enabled && endpoint.isDefault);
  if (!currentDefault) reject('服务商没有可用默认端点');
  const endpoints = current.map((endpoint) => ({
    protocol: endpoint.id === currentDefault.id ? (body.protocol ?? endpoint.protocol) as ProviderProtocol : endpoint.protocol,
    base_url: endpoint.id === currentDefault.id ? (body.base_url ?? endpoint.baseUrl) as string : endpoint.baseUrl,
    enabled: endpoint.enabled,
    is_default: endpoint.id === currentDefault.id,
    preset_variant_slug: endpoint.presetVariantSlug,
    source_ref: endpoint.sourceRef,
    model_catalog_complete: endpoint.modelCatalogComplete,
    models_observed_at: endpoint.modelsObservedAt,
  }));
  return validateCompleteEndpointSet(applyDefaultProtocol(endpoints, body.default_protocol, body.default_protocol !== undefined), validateUrl);
}
