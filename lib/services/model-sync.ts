import type Database from 'better-sqlite3';
import { providerForEndpoint } from '../gateway/endpoint-attempt-context.ts';
import { getEnabledDefaultEndpoint, replaceEndpointModelCatalogInTransaction } from './provider-endpoint.ts';

export interface SyncProviderRow {
  id: string;
  slug: string;
  protocol: string;
  baseUrl: string;
}

export interface SyncPricing {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  source: string;
}

export interface SyncModelsDependencies {
  sqlite: Database.Database;
  fetch: typeof fetch;
  lookupPricing(baseUrl: string, protocol: string, modelId: string): SyncPricing | null;
  randomId(): string;
  pricingSourceRef: string;
  now(): number;
}

export interface SyncResult {
  added: number;
  existing: number;
  removed_not_in_upstream: number;
  total_upstream: number;
}

const SYNC_TIMEOUT_MS = 30_000;
const MAX_MODEL_PAGES = 100;

function modelListRequest(provider: SyncProviderRow, apiKey: string, cursor: string | null): { url: string; headers: Record<string, string> } {
  const base = provider.baseUrl.replace(/\/+$/, '');
  const url = new URL(
    provider.protocol === 'gemini'
      ? `${base}/v1beta/models`
      : provider.protocol === 'anthropic'
        ? `${base}/v1/models`
        : `${base}/models`,
  );
  if (cursor) url.searchParams.set(provider.protocol === 'gemini' ? 'pageToken' : 'after_id', cursor);
  if (provider.protocol === 'gemini') return { url: url.toString(), headers: { 'x-goog-api-key': apiKey } };
  if (provider.protocol === 'anthropic') {
    return { url: url.toString(), headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } };
  }
  return { url: url.toString(), headers: { Authorization: `Bearer ${apiKey}` } };
}

function parseModelPage(provider: SyncProviderRow, json: unknown): { ids: string[]; cursor: string | null } {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('模型列表响应必须是 JSON 对象');
  const body = json as Record<string, unknown>;
  const field = provider.protocol === 'gemini' ? 'models' : 'data';
  const items = body[field];
  if (!Array.isArray(items)) throw new Error(`模型列表响应的 ${field} 必须是数组`);
  const ids = items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${field}[${index}] 必须是对象`);
    const rawId = provider.protocol === 'gemini'
      ? (item as Record<string, unknown>).name
      : (item as Record<string, unknown>).id;
    if (typeof rawId !== 'string' || !rawId.trim()) throw new Error(`${field}[${index}] 缺少有效模型 ID`);
    return provider.protocol === 'gemini' ? rawId.trim().replace(/^models\//, '') : rawId.trim();
  });

  if (provider.protocol === 'gemini') {
    const next = body.nextPageToken;
    if (next === undefined || next === null || next === '') return { ids, cursor: null };
    if (typeof next !== 'string') throw new Error('nextPageToken 必须是字符串');
    return { ids, cursor: next };
  }

  const hasMore = body.has_more;
  if (hasMore === undefined || hasMore === false) return { ids, cursor: null };
  if (hasMore !== true) throw new Error('has_more 必须是 boolean');
  const lastId = body.last_id;
  if (typeof lastId !== 'string' || !lastId.trim()) throw new Error('has_more=true 时必须提供 last_id');
  return { ids, cursor: lastId.trim() };
}

/** Fetches and validates every model-list page before any database mutation. */
export async function fetchAllUpstreamModels(
  provider: SyncProviderRow,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const ids: string[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  for (let page = 1; page <= MAX_MODEL_PAGES; page++) {
    const request = modelListRequest(provider, apiKey, cursor);
    const response = await fetchImpl(request.url, {
      headers: request.headers,
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    if (!response.ok) {
      const text = (await response.text()).slice(0, 300);
      throw new Error(`上游返回 ${response.status}: ${text}`);
    }
    const parsed = parseModelPage(provider, await response.json());
    ids.push(...parsed.ids);
    if (!parsed.cursor) return [...new Set(ids)];
    if (seenCursors.has(parsed.cursor)) throw new Error(`模型列表分页游标循环: ${parsed.cursor}`);
    seenCursors.add(parsed.cursor);
    cursor = parsed.cursor;
  }
  throw new Error(`模型列表分页超过 ${MAX_MODEL_PAGES} 页`);
}

/** Resolves the default endpoint exactly once, then writes the fetched catalog back to that endpoint ID. */
export async function syncProviderModels(
  provider: SyncProviderRow,
  apiKey: string,
  dependencies: SyncModelsDependencies,
): Promise<SyncResult> {
  const defaultEndpoint = getEnabledDefaultEndpoint(dependencies.sqlite, provider.id);
  if (!defaultEndpoint) throw new Error('服务商没有启用的默认端点');
  const requestProvider = providerForEndpoint(provider, defaultEndpoint);
  const upstreamIds = await fetchAllUpstreamModels(requestProvider, apiKey, dependencies.fetch);
  const upstreamSet = new Set(upstreamIds);
  const existingRows = dependencies.sqlite.prepare(`
    SELECT model_id AS modelId, synced FROM models WHERE provider_id = ?
  `).all(provider.id) as Array<{ modelId: string; synced: number }>;
  const existingIds = new Set(existingRows.map((model) => model.modelId));
  const observedAt = dependencies.now();
  let added = 0;

  dependencies.sqlite.transaction(() => {
    const insert = dependencies.sqlite.prepare(`
      INSERT INTO models (
        id, provider_id, model_id, enabled, synced,
        input_price, output_price, cache_read_price, cache_write_price,
        pricing_source, pricing_source_ref, pricing_synced_at
      ) VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const modelId of upstreamIds) {
      if (existingIds.has(modelId)) continue;
      const pricing = dependencies.lookupPricing(requestProvider.baseUrl, requestProvider.protocol, modelId);
      insert.run(
        dependencies.randomId(), provider.id, modelId,
        pricing?.input ?? null, pricing?.output ?? null, pricing?.cacheRead ?? null, pricing?.cacheWrite ?? null,
        pricing?.source ?? null, pricing ? dependencies.pricingSourceRef : null, pricing ? observedAt : null,
      );
      added++;
    }
    replaceEndpointModelCatalogInTransaction(dependencies.sqlite, defaultEndpoint.id, upstreamIds, observedAt);
  })();

  return {
    added,
    existing: upstreamIds.length - added,
    removed_not_in_upstream: existingRows.filter((model) => model.synced === 1 && !upstreamSet.has(model.modelId)).length,
    total_upstream: upstreamIds.length,
  };
}
