import type Database from 'better-sqlite3';
import type { ProviderPreset, ProviderProtocol } from '../presets/types.ts';
import { validateProviderBaseUrl } from './provider-url.ts';

export const ENDPOINT_PROTOCOLS = ['openai', 'openai-responses', 'anthropic', 'gemini'] as const;

export interface EndpointInput {
  protocol: ProviderProtocol;
  base_url: string;
  enabled?: boolean;
  is_default?: boolean;
  preset_variant_slug?: string | null;
  source_ref?: string | null;
  model_catalog_complete?: boolean;
  models_observed_at?: number | null;
  models?: Array<{ model_id: string; source: 'preset' | 'sync'; observed_at?: number | null }>;
}

export interface ProviderEndpoint {
  id: string;
  providerId: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  enabled: boolean;
  isDefault: boolean;
  presetVariantSlug: string | null;
  sourceRef: string | null;
  modelCatalogComplete: boolean;
  modelsObservedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export class EndpointValidationError extends Error {}

function invalid(message: string): never {
  throw new EndpointValidationError(message);
}

function endpointFromRow(row: Record<string, unknown>): ProviderEndpoint {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    protocol: row.protocol as ProviderProtocol,
    baseUrl: String(row.base_url),
    enabled: row.enabled === 1,
    isDefault: row.is_default === 1,
    presetVariantSlug: row.preset_variant_slug as string | null,
    sourceRef: row.source_ref as string | null,
    modelCatalogComplete: row.model_catalog_complete === 1,
    modelsObservedAt: row.models_observed_at as number | null,
    createdAt: row.created_at as number | null,
    updatedAt: row.updated_at as number | null,
  };
}

/** Validate and normalize the complete, client-visible endpoint set. */
export function validateCompleteEndpointSet(
  inputs: EndpointInput[],
  validateUrl: (baseUrl: string) => string | null = validateProviderBaseUrl,
): Required<Pick<EndpointInput, 'protocol' | 'base_url' | 'enabled' | 'is_default'>>[] & EndpointInput[] {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 4) invalid('endpoints 必须包含 1–4 个端点');
  const protocols = new Set<string>();
  const normalized = inputs.map((input) => {
    if (!input || typeof input.protocol !== 'string' || !(ENDPOINT_PROTOCOLS as readonly string[]).includes(input.protocol)) {
      invalid(`endpoint protocol 必须是 ${ENDPOINT_PROTOCOLS.join(' / ')}`);
    }
    if (input.enabled !== undefined && typeof input.enabled !== 'boolean') invalid('endpoint enabled 必须是 boolean');
    if (input.is_default !== undefined && typeof input.is_default !== 'boolean') invalid('endpoint is_default 必须是 boolean');
    if (protocols.has(input.protocol)) invalid('endpoints 中 protocol 不能重复');
    protocols.add(input.protocol);
    if (typeof input.base_url !== 'string') invalid('endpoint base_url 必须是字符串');
    const baseUrl = input.base_url.trim();
    if (!baseUrl) invalid('endpoint base_url 不能为空');
    const urlError = validateUrl(baseUrl);
    if (urlError) invalid(urlError);
    return { ...input, base_url: baseUrl, enabled: input.enabled !== false, is_default: input.is_default === true };
  });
  if (!normalized.some((endpoint) => endpoint.enabled)) invalid('至少需要一个启用的端点');
  const defaults = normalized.filter((endpoint) => endpoint.is_default);
  if (defaults.length !== 1) invalid('必须且只能指定一个默认端点');
  if (!defaults[0].enabled) invalid('默认端点必须启用');
  return normalized;
}

export function materializePresetEndpoints(preset: ProviderPreset): EndpointInput[] {
  return validateCompleteEndpointSet(
    preset.endpoints.map((endpoint) => ({
      protocol: endpoint.protocol,
      base_url: endpoint.baseUrl,
      enabled: true,
      is_default: endpoint.protocol === preset.defaultProtocol,
      preset_variant_slug: endpoint.selectedVariantSlug,
      source_ref: preset.presetKey,
      model_catalog_complete: false,
      models: endpoint.knownModels
        .filter((model) => model.id.trim().length > 0)
        .map((model) => ({ model_id: model.id, source: 'preset' as const })),
    })),
  );
}

export function listProviderEndpoints(sqlite: Database.Database, providerId: string): ProviderEndpoint[] {
  return (sqlite.prepare(`
    SELECT * FROM provider_endpoints
    WHERE provider_id = ?
    ORDER BY is_default DESC, protocol ASC
  `).all(providerId) as Array<Record<string, unknown>>).map(endpointFromRow);
}

export function getEnabledDefaultEndpoint(sqlite: Database.Database, providerId: string): ProviderEndpoint | undefined {
  const row = sqlite.prepare(`
    SELECT * FROM provider_endpoints
    WHERE provider_id = ? AND enabled = 1 AND is_default = 1
    LIMIT 1
  `).get(providerId) as Record<string, unknown> | undefined;
  return row ? endpointFromRow(row) : undefined;
}

export function serializeEndpoint(endpoint: ProviderEndpoint) {
  return {
    id: endpoint.id,
    protocol: endpoint.protocol,
    base_url: endpoint.baseUrl,
    enabled: endpoint.enabled,
    is_default: endpoint.isDefault,
    preset_variant_slug: endpoint.presetVariantSlug,
    source_ref: endpoint.sourceRef,
    model_catalog_complete: endpoint.modelCatalogComplete,
    models_observed_at: endpoint.modelsObservedAt,
    created_at: endpoint.createdAt,
    updated_at: endpoint.updatedAt,
  };
}

/**
 * Replaces a provider's complete endpoint set while updating the legacy
 * providers.protocol/base_url projection in the same better-sqlite transaction.
 */
export function replaceProviderEndpoints(
  sqlite: Database.Database,
  providerId: string,
  endpointInputs: EndpointInput[],
  now = Date.now(),
  validateUrl?: (baseUrl: string) => string | null,
): ProviderEndpoint[] {
  const endpoints = validateCompleteEndpointSet(endpointInputs, validateUrl);
  sqlite.transaction(() => {
    const upsert = sqlite.prepare(`
      INSERT INTO provider_endpoints (
        id, provider_id, protocol, base_url, enabled, is_default,
        preset_variant_slug, source_ref, model_catalog_complete, models_observed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_id, protocol) DO UPDATE SET
        base_url = excluded.base_url,
        enabled = excluded.enabled,
        is_default = excluded.is_default,
        preset_variant_slug = COALESCE(excluded.preset_variant_slug, provider_endpoints.preset_variant_slug),
        source_ref = COALESCE(excluded.source_ref, provider_endpoints.source_ref),
        model_catalog_complete = excluded.model_catalog_complete,
        models_observed_at = COALESCE(excluded.models_observed_at, provider_endpoints.models_observed_at),
        updated_at = excluded.updated_at
    `);
    const existingEndpoint = sqlite.prepare(`
      SELECT id, model_catalog_complete, models_observed_at
      FROM provider_endpoints WHERE provider_id = ? AND protocol = ?
    `);
    const seedModel = sqlite.prepare(`
      INSERT INTO provider_endpoint_models (endpoint_id, model_id, source, observed_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint_id, model_id) DO UPDATE SET
        source = CASE
          WHEN excluded.source = 'sync' THEN 'sync'
          WHEN provider_endpoint_models.source = 'sync' THEN 'sync'
          ELSE excluded.source
        END,
        observed_at = CASE
          WHEN excluded.source = 'sync' THEN excluded.observed_at
          WHEN provider_endpoint_models.source = 'sync' THEN provider_endpoint_models.observed_at
          ELSE excluded.observed_at
        END
    `);
    const deletePresetModels = sqlite.prepare("DELETE FROM provider_endpoint_models WHERE endpoint_id = ? AND source = 'preset'");

    for (const endpoint of endpoints) {
      const existing = existingEndpoint.get(providerId, endpoint.protocol) as
        | { id: string; model_catalog_complete: number; models_observed_at: number | null }
        | undefined;
      const modelCatalogComplete = endpoint.model_catalog_complete ?? (existing?.model_catalog_complete === 1);
      const modelsObservedAt = endpoint.models_observed_at ?? existing?.models_observed_at ?? (endpoint.models ? now : null);
      upsert.run(
        cryptoRandomId(sqlite), providerId, endpoint.protocol, endpoint.base_url, endpoint.enabled ? 1 : 0, endpoint.is_default ? 1 : 0,
        endpoint.preset_variant_slug ?? null, endpoint.source_ref ?? null, modelCatalogComplete ? 1 : 0,
        modelsObservedAt, now, now,
      );
      if (endpoint.models) {
        const id = (existingEndpoint.get(providerId, endpoint.protocol) as { id: string }).id;
        if (endpoint.source_ref !== undefined) deletePresetModels.run(id);
        for (const model of endpoint.models) {
          if (!model.model_id.trim()) continue;
          seedModel.run(id, model.model_id, model.source, model.observed_at ?? now);
        }
      }
    }
    const placeholders = endpoints.map(() => '?').join(', ');
    sqlite.prepare(`DELETE FROM provider_endpoints WHERE provider_id = ? AND protocol NOT IN (${placeholders})`)
      .run(providerId, ...endpoints.map((endpoint) => endpoint.protocol));
    const defaultEndpoint = endpoints.find((endpoint) => endpoint.is_default)!;
    const update = sqlite.prepare('UPDATE providers SET protocol = ?, base_url = ?, updated_at = ? WHERE id = ?');
    const result = update.run(defaultEndpoint.protocol, defaultEndpoint.base_url, now, providerId);
    if (result.changes !== 1) throw new Error('服务商不存在');
  })();
  return listProviderEndpoints(sqlite, providerId);
}

// SQLite 生成的 id 可避免把 Node crypto 引入纯迁移/服务测试路径。
function cryptoRandomId(sqlite: Database.Database): string {
  return (sqlite.prepare('SELECT lower(hex(randomblob(16))) AS id').get() as { id: string }).id;
}
