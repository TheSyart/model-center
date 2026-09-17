import type Database from 'better-sqlite3';
import { providerForEndpoint } from '../gateway/endpoint-attempt-context.ts';
import { bailianCatalogUrl, isOfficialBailianCatalogProvider } from './bailian-catalog.ts';
import { getEnabledDefaultEndpoint, replaceEndpointModelCatalogInTransaction } from './provider-endpoint.ts';

export interface SyncProviderRow {
  id: string;
  slug: string;
  protocol: string;
  baseUrl: string;
  presetKey?: string | null;
  workspaceId?: string | null;
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
const BAILIAN_PAGE_SIZE = 20;
const BAILIAN_MAX_ATTEMPTS = 5;

interface UpstreamModelRecord {
  id: string;
  displayName: string | null;
  contextWindow: number | null;
}

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
    if (typeof rawId !== 'string') throw new Error(`${field}[${index}] 缺少有效模型 ID`);
    const normalizedId = (provider.protocol === 'gemini' ? rawId.trim().replace(/^models\//, '') : rawId).trim();
    if (!normalizedId) throw new Error(`${field}[${index}] 缺少有效模型 ID`);
    return normalizedId;
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

function bailianErrorPart(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 300) : null;
}

function optionalCatalogText(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${field} 必须是字符串或 null`);
  return value.trim() || null;
}

function optionalContextWindow(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`${field} 必须是非负整数或 null`);
  return Number(value);
}

function parseBailianPage(json: unknown, expectedPage: number): {
  total: number;
  pageSize: number;
  models: UpstreamModelRecord[];
} {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('百炼模型列表响应必须是 JSON 对象');
  const body = json as Record<string, unknown>;
  if (body.success !== true) {
    const details = [bailianErrorPart(body.code), bailianErrorPart(body.message), bailianErrorPart(body.request_id)]
      .filter((part): part is string => !!part)
      .join(' · ');
    throw new Error(`百炼模型目录业务请求失败${details ? `: ${details}` : ''}`);
  }
  if (!body.output || typeof body.output !== 'object' || Array.isArray(body.output)) {
    throw new Error('百炼模型列表响应缺少 output 对象');
  }
  const output = body.output as Record<string, unknown>;
  if (!Number.isSafeInteger(output.total) || Number(output.total) < 0) throw new Error('百炼 output.total 必须是非负整数');
  if (output.page_no !== expectedPage) throw new Error(`百炼 output.page_no 与请求页不一致: ${String(output.page_no)}`);
  if (!Number.isSafeInteger(output.page_size) || Number(output.page_size) < 1) throw new Error('百炼 output.page_size 必须是正整数');
  if (!Array.isArray(output.models)) throw new Error('百炼 output.models 必须是数组');
  if (output.models.length > Number(output.page_size)) throw new Error('百炼 output.models 数量超过 output.page_size');
  const models = output.models.map((item, index): UpstreamModelRecord => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`百炼 output.models[${index}] 必须是对象`);
    const row = item as Record<string, unknown>;
    if (typeof row.model !== 'string' || !row.model.trim()) throw new Error(`百炼 output.models[${index}] 缺少有效模型 ID`);
    const modelInfo = row.model_info;
    if (modelInfo !== undefined && modelInfo !== null && (typeof modelInfo !== 'object' || Array.isArray(modelInfo))) {
      throw new Error(`百炼 output.models[${index}].model_info 必须是对象或 null`);
    }
    return {
      id: row.model.trim(),
      displayName: optionalCatalogText(row.name, `百炼 output.models[${index}].name`),
      contextWindow: optionalContextWindow(
        modelInfo && typeof modelInfo === 'object' ? (modelInfo as Record<string, unknown>).context_window : null,
        `百炼 output.models[${index}].model_info.context_window`,
      ),
    };
  });
  return { total: Number(output.total), pageSize: Number(output.page_size), models };
}

function bailianRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 30_000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(Math.max(0, date - Date.now()), 30_000);
  }
  return Math.min(2_000 * (2 ** (attempt - 1)), 30_000);
}

async function fetchBailianPage(
  provider: SyncProviderRow,
  apiKey: string,
  page: number,
  fetchImpl: typeof fetch,
): Promise<Response> {
  for (let attempt = 1; attempt <= BAILIAN_MAX_ATTEMPTS; attempt++) {
    const response = await fetchImpl(bailianCatalogUrl(provider.workspaceId, page, BAILIAN_PAGE_SIZE), {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    if (response.status !== 429) return response;
    const body = (await response.text()).slice(0, 300);
    if (attempt === BAILIAN_MAX_ATTEMPTS) throw new Error(`百炼模型目录返回 429: ${body}`);
    await new Promise((resolve) => setTimeout(resolve, bailianRetryDelayMs(response, attempt)));
  }
  throw new Error('百炼模型目录重试状态异常');
}

async function fetchBailianModels(provider: SyncProviderRow, apiKey: string, fetchImpl: typeof fetch): Promise<UpstreamModelRecord[]> {
  const models: UpstreamModelRecord[] = [];
  const seenIds = new Set<string>();
  let expectedTotal: number | null = null;
  for (let page = 1; page <= MAX_MODEL_PAGES; page++) {
    const response = await fetchBailianPage(provider, apiKey, page, fetchImpl);
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`百炼模型目录返回 ${response.status}: ${body}`);
    }
    const parsed = parseBailianPage(await response.json(), page);
    if (expectedTotal === null) expectedTotal = parsed.total;
    else if (parsed.total !== expectedTotal) throw new Error(`百炼 output.total 在分页期间发生变化: ${expectedTotal} -> ${parsed.total}`);
    for (const model of parsed.models) {
      if (seenIds.has(model.id)) throw new Error(`百炼模型目录出现重复模型 ID: ${model.id}`);
      seenIds.add(model.id);
      models.push(model);
    }
    if (models.length === expectedTotal) return models;
    if (models.length > expectedTotal) throw new Error(`百炼模型目录数量超过 output.total: ${models.length} > ${expectedTotal}`);
    if (parsed.models.length === 0) throw new Error(`百炼模型目录在第 ${page} 页提前返回空页`);
  }
  throw new Error(`百炼模型列表分页超过 ${MAX_MODEL_PAGES} 页`);
}

async function fetchAllUpstreamModelRecords(
  provider: SyncProviderRow,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<UpstreamModelRecord[]> {
  if (isOfficialBailianCatalogProvider(provider)) return fetchBailianModels(provider, apiKey, fetchImpl);
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
    if (!parsed.cursor) return [...new Set(ids)].map((id) => ({ id, displayName: null, contextWindow: null }));
    if (seenCursors.has(parsed.cursor)) throw new Error(`模型列表分页游标循环: ${parsed.cursor}`);
    seenCursors.add(parsed.cursor);
    cursor = parsed.cursor;
  }
  throw new Error(`模型列表分页超过 ${MAX_MODEL_PAGES} 页`);
}

/** Fetches and validates every model-list page before any database mutation. */
export async function fetchAllUpstreamModels(
  provider: SyncProviderRow,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  return (await fetchAllUpstreamModelRecords(provider, apiKey, fetchImpl)).map((model) => model.id);
}

/** Resolves the default endpoint exactly once, then writes the fetched catalog back to that endpoint ID. */
export async function syncProviderModels(
  provider: SyncProviderRow,
  apiKey: string,
  dependencies: SyncModelsDependencies,
): Promise<SyncResult> {
  const defaultEndpoint = getEnabledDefaultEndpoint(dependencies.sqlite, provider.id);
  if (!defaultEndpoint) throw new Error('服务商没有启用的默认端点');
  const endpointSnapshot = {
    id: defaultEndpoint.id,
    providerId: defaultEndpoint.providerId,
    protocol: defaultEndpoint.protocol,
    baseUrl: defaultEndpoint.baseUrl,
  };
  const requestProvider = providerForEndpoint(provider, endpointSnapshot);
  const bailianCatalog = isOfficialBailianCatalogProvider(requestProvider);
  const upstreamModels = await fetchAllUpstreamModelRecords(requestProvider, apiKey, dependencies.fetch);
  const upstreamIds = upstreamModels.map((model) => model.id);
  const upstreamSet = new Set(upstreamIds);
  const existingRows = dependencies.sqlite.prepare(`
    SELECT model_id AS modelId, synced FROM models WHERE provider_id = ?
  `).all(provider.id) as Array<{ modelId: string; synced: number }>;
  const existingIds = new Set(existingRows.map((model) => model.modelId));
  const observedAt = dependencies.now();
  let added = 0;

  dependencies.sqlite.transaction(() => {
    const currentEndpoint = dependencies.sqlite.prepare(`
      SELECT id, provider_id AS providerId, protocol, base_url AS baseUrl
      FROM provider_endpoints WHERE id = ?
    `).get(endpointSnapshot.id) as typeof endpointSnapshot | undefined;
    if (
      !currentEndpoint ||
      currentEndpoint.id !== endpointSnapshot.id ||
      currentEndpoint.providerId !== endpointSnapshot.providerId ||
      currentEndpoint.protocol !== endpointSnapshot.protocol ||
      currentEndpoint.baseUrl !== endpointSnapshot.baseUrl
    ) {
      throw new Error('端点配置已变更，请重试');
    }
    const insert = dependencies.sqlite.prepare(`
      INSERT INTO models (
        id, provider_id, model_id, display_name, context_window, enabled, synced,
        input_price, output_price, cache_read_price, cache_write_price,
        pricing_source, pricing_source_ref, pricing_synced_at
      ) VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?)
    `);
    const fillMissingOfficialMetadata = dependencies.sqlite.prepare(`
      UPDATE models
      SET display_name = COALESCE(display_name, ?), context_window = COALESCE(context_window, ?)
      WHERE provider_id = ? AND model_id = ?
    `);
    for (const model of upstreamModels) {
      if (existingIds.has(model.id)) {
        if (bailianCatalog) fillMissingOfficialMetadata.run(model.displayName, model.contextWindow, provider.id, model.id);
        continue;
      }
      const pricing = bailianCatalog ? null : dependencies.lookupPricing(requestProvider.baseUrl, requestProvider.protocol, model.id);
      insert.run(
        dependencies.randomId(), provider.id, model.id, model.displayName, model.contextWindow,
        pricing?.input ?? null, pricing?.output ?? null, pricing?.cacheRead ?? null, pricing?.cacheWrite ?? null,
        pricing?.source ?? null, pricing ? dependencies.pricingSourceRef : null, pricing ? observedAt : null,
      );
      added++;
    }
    replaceEndpointModelCatalogInTransaction(dependencies.sqlite, endpointSnapshot.id, upstreamIds, observedAt, !bailianCatalog);
  })();

  return {
    added,
    existing: upstreamIds.length - added,
    removed_not_in_upstream: existingRows.filter((model) => model.synced === 1 && !upstreamSet.has(model.modelId)).length,
    total_upstream: upstreamIds.length,
  };
}
