import type Database from 'better-sqlite3';
import { providerForEndpoint } from '../gateway/endpoint-attempt-context.ts';
import {
  bailianCatalogUrl,
  isOfficialBailianCatalogProvider,
  type BailianCatalogFilterOptions,
} from '../vendors/bailian/catalog.ts';
import { getEnabledDefaultEndpoint, replaceEndpointModelCatalogInTransaction } from './provider-endpoint.ts';
import { CC_SWITCH_OWNED_PRICING_SOURCES } from '../db/pricing-migration.ts';
import { isKimiCatalogProvider, parseKimiModelPage } from '../vendors/kimi/catalog.ts';

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
  /** 本地已同步但不在本次上游结果中的数量。prune 关闭时只是统计，不代表被删。 */
  removed_not_in_upstream: number;
  total_upstream: number;
  /** prune 模式下真正删除的数量。 */
  removed: number;
  /** 手动添加（synced=0）而保留，不会被同步删除。 */
  kept_manual: number;
  /** 被路由别名引用而保留，删了会直接断路由。 */
  kept_referenced: number;
  /** 本次同步重新写入价格的已有模型数（手动定价的行不计入，也不会被改）。 */
  repriced: number;
}

const SYNC_TIMEOUT_MS = 30_000;
const MAX_MODEL_PAGES = 100;
const BAILIAN_PAGE_SIZE = 20;
const BAILIAN_MAX_ATTEMPTS = 5;

interface UpstreamModelRecord {
  id: string;
  displayName: string | null;
  contextWindow: number | null;
  capabilitiesJson?: string | null;
  /** 官方 prices[] 原样保留（全部阶梯 + 非 Token 计费项）。 */
  pricingTiersJson?: string | null;
  /** 官方币种；响应没有该字段，由可识别的 price_unit 推出，否则为 null。 */
  pricingCurrency?: string | null;
  /** 上游目录给出的思考强度档位（Kimi think_efforts）。 */
  reasoningJson?: string | null;
  /** 单档且单位可识别时折算出的每百万 token 单价。 */
  officialInput?: number | null;
  officialOutput?: number | null;
  officialCacheRead?: number | null;
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

/**
 * 百炼 `prices[]` 的真实结构（2026-09-19 用真实密钥核对 llm-a5kyboh5x4q9inqe 工作空间）：
 *
 *   [{ range_name: "Default",
 *      prices: [{ type: "input_token",       price: "2.1",  price_unit: "每百万tokens", time_band: "standard" },
 *               { type: "output_token",      price: "8.4",  price_unit: "每百万tokens", time_band: "standard" },
 *               { type: "input_token_cache", price: "0.42", price_unit: "每百万tokens", time_band: "standard" }] }]
 *
 * 也就是「档位 → 计费项」两层，不是扁平列表。三点与既有文档假设不同：
 *   1. 单位**是给了的**（`price_unit`），不需要再猜；
 *   2. 缓存读取的 type 是 `input_token_cache`，文档此前标记为枚举未知；
 *   3. 仍然**没有币种字段**——见 bailianPriceUnit 的推断依据。
 */
const BAILIAN_PRICE_UNITS: Record<string, { perMillion: number; currency: string | null }> = {
  // 中文单位串只出现在国内站，且实测数值与官网人民币标价一致
  // （MiniMax-M2.1 输入 2.1 / 输出 8.4，即 ¥2.1、¥8.4 每百万 token），故判定为 CNY。
  每百万tokens: { perMillion: 1, currency: 'CNY' },
  每百万Token: { perMillion: 1, currency: 'CNY' },
  每千tokens: { perMillion: 1_000, currency: 'CNY' },
  每千Token: { perMillion: 1_000, currency: 'CNY' },
};

/** 把一个计费项的单价换算成「每百万 token」。无法识别的单位返回 null，绝不臆测。 */
function bailianPriceUnit(unit: unknown): { perMillion: number; currency: string | null } | null {
  const key = typeof unit === 'string' ? unit.trim() : '';
  return BAILIAN_PRICE_UNITS[key] ?? null;
}

const BAILIAN_PRICE_FIELDS: Record<string, 'input' | 'output' | 'cacheRead'> = {
  input_token: 'input',
  output_token: 'output',
  input_token_cache: 'cacheRead',
};

interface BailianPricing {
  tiersJson: string | null;
  currency: string | null;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
}

/**
 * 原样保留全部档位与计费项；只有在「单档 + 单位可识别」时才折算出扁平单价。
 * 多档阶梯（例如 `32k<Input<=128k`）一律不折算，因为一次请求落在哪一档取决于实际用量，
 * 取任意一档冒充固定单价都是错的。未识别的 type（图片张数等）只留存，不映射。
 */
function parseBailianPrices(raw: unknown): BailianPricing {
  const empty: BailianPricing = { tiersJson: null, currency: null, input: null, output: null, cacheRead: null };
  if (!Array.isArray(raw) || raw.length === 0) return empty;
  const tiersJson = JSON.stringify(raw);

  const bands = raw.filter((b): b is Record<string, unknown> => !!b && typeof b === 'object' && !Array.isArray(b));
  // 只有单档才折算。出现 `Default` + `32k<Input<=128k` 这类分档时，一次请求适用哪一档
  // 取决于实际输入长度，挑 Default（或最低档、或平均）冒充固定单价都会算错账。
  if (bands.length !== 1) return { ...empty, tiersJson };
  const base = bands[0];

  const items = Array.isArray(base.prices) ? base.prices : [];
  const out: BailianPricing = { ...empty, tiersJson };
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    // 分时定价：只取标准档，优惠时段不能当常价。
    const band = typeof row.time_band === 'string' ? row.time_band.trim() : '';
    if (band && band !== 'standard') continue;
    const field = BAILIAN_PRICE_FIELDS[String(row.type ?? '')];
    const unit = bailianPriceUnit(row.price_unit);
    if (!field || !unit) continue;
    const value = Number(row.price);
    if (!Number.isFinite(value) || value < 0) continue;
    out[field] = value * unit.perMillion;
    if (unit.currency) out.currency = unit.currency;
  }
  return out;
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

    const rawCapabilities = Array.isArray(row.capabilities)
      ? row.capabilities.filter((c): c is string => typeof c === 'string' && !!c.trim())
      : [];
    const rawFeatures = Array.isArray(row.features)
      ? row.features.filter((f): f is string => typeof f === 'string' && !!f.trim())
      : [];
    const inferenceMeta = row.inference_metadata && typeof row.inference_metadata === 'object'
      ? (row.inference_metadata as Record<string, unknown>)
      : null;
    const stringList = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v.trim()) : [];
    const modalities = inferenceMeta ? stringList(inferenceMeta.request_modality) : [];
    // 输出模态此前整个丢失；契约要求输入/输出都记录，缺失和空列表都不等同于「只支持文本」。
    const responseModalities = inferenceMeta ? stringList(inferenceMeta.response_modality) : [];

    const info = modelInfo && typeof modelInfo === 'object' ? (modelInfo as Record<string, unknown>) : null;
    const numericInfo = (key: string): number | null => {
      const value = info?.[key];
      return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
    };
    const textField = (value: unknown): string | null =>
      typeof value === 'string' && value.trim() ? value.trim() : null;

    // 契约要求保留的展示资料与 token 上限，一并放进已有的 capabilities JSON，不再新开列。
    const catalog = {
      description: textField(row.description),
      provider: textField(row.provider),
      inferenceProvider: textField(row.inference_provider),
      publishedTime: textField(row.published_time),
      equivalentSnapshot: textField(row.equivalent_snapshot),
      maxInputTokens: numericInfo('max_input_tokens'),
      maxOutputTokens: numericInfo('max_output_tokens'),
      maxReasoningTokens: numericInfo('max_reasoning_tokens'),
      reasoningMaxInputTokens: numericInfo('reasoning_max_input_tokens'),
      reasoningMaxOutputTokens: numericInfo('reasoning_max_output_tokens'),
    };
    const hasCatalogDetail = Object.values(catalog).some((value) => value !== null);

    let capabilitiesJson: string | null = null;
    if (rawCapabilities.length > 0 || rawFeatures.length > 0 || modalities.length > 0 || hasCatalogDetail) {
      capabilitiesJson = JSON.stringify({
        rawCapabilities,
        rawFeatures,
        modalities,
        responseModalities,
        ...catalog,
        vision: rawCapabilities.includes('VU') || modalities.includes('Image'),
        tools: rawFeatures.includes('function-calling'),
        reasoning: rawCapabilities.includes('Reasoning'),
        asr: rawCapabilities.includes('ASR') || rawCapabilities.includes('Realtime-ASR'),
        tts: rawCapabilities.includes('TTS') || rawCapabilities.includes('Realtime-Text-to-Speech'),
        web_search: rawFeatures.includes('web-search'),
      });
    }

    const prices = parseBailianPrices(row.prices);

    return {
      id: row.model.trim(),
      displayName: optionalCatalogText(row.name, `百炼 output.models[${index}].name`),
      contextWindow: optionalContextWindow(
        modelInfo && typeof modelInfo === 'object' ? (modelInfo as Record<string, unknown>).context_window : null,
        `百炼 output.models[${index}].model_info.context_window`,
      ),
      capabilitiesJson,
      pricingTiersJson: prices.tiersJson,
      pricingCurrency: prices.currency,
      officialInput: prices.input,
      officialOutput: prices.output,
      officialCacheRead: prices.cacheRead,
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
  filter?: BailianCatalogFilterOptions,
): Promise<Response> {
  for (let attempt = 1; attempt <= BAILIAN_MAX_ATTEMPTS; attempt++) {
    const response = await fetchImpl(bailianCatalogUrl(provider.workspaceId, page, BAILIAN_PAGE_SIZE, filter), {
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

async function fetchBailianModels(
  provider: SyncProviderRow,
  apiKey: string,
  fetchImpl: typeof fetch,
  filter?: BailianCatalogFilterOptions,
): Promise<UpstreamModelRecord[]> {
  const models: UpstreamModelRecord[] = [];
  const seenIds = new Set<string>();
  let expectedTotal: number | null = null;
  for (let page = 1; page <= MAX_MODEL_PAGES; page++) {
    const response = await fetchBailianPage(provider, apiKey, page, fetchImpl, filter);
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

/** Kimi 一次返回全部模型，没有分页游标。 */
async function fetchKimiModels(
  provider: SyncProviderRow,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<UpstreamModelRecord[]> {
  const url = `${provider.baseUrl.replace(/\/+$/, '')}/models`;
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`上游返回 ${response.status}: ${body}`);
  }
  const records = parseKimiModelPage(await response.json());
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) throw new Error(`Kimi 模型列表出现重复 ID: ${record.id}`);
    seen.add(record.id);
  }
  return records;
}

async function fetchAllUpstreamModelRecords(
  provider: SyncProviderRow,
  apiKey: string,
  fetchImpl: typeof fetch,
  filter?: BailianCatalogFilterOptions,
): Promise<UpstreamModelRecord[]> {
  if (isOfficialBailianCatalogProvider(provider)) return fetchBailianModels(provider, apiKey, fetchImpl, filter);
  if (isKimiCatalogProvider(provider)) return fetchKimiModels(provider, apiKey, fetchImpl);
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
  filter?: BailianCatalogFilterOptions,
): Promise<string[]> {
  return (await fetchAllUpstreamModelRecords(provider, apiKey, fetchImpl, filter)).map((model) => model.id);
}

/** Resolves the default endpoint exactly once, then writes the fetched catalog back to that endpoint ID. */
export async function syncProviderModels(
  provider: SyncProviderRow,
  apiKey: string,
  dependencies: SyncModelsDependencies,
  filter?: BailianCatalogFilterOptions,
  /** prune：让本地已同步集合与本次上游结果一致（筛选同步用）。 */
  options?: { prune?: boolean },
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
  // 官方目录会带回展示名、上下文、能力等元数据；非官方目录的通用 /models 只有 id。
  const officialCatalog = bailianCatalog || isKimiCatalogProvider(requestProvider);
  const upstreamModels = await fetchAllUpstreamModelRecords(requestProvider, apiKey, dependencies.fetch, filter);
  const upstreamIds = upstreamModels.map((model) => model.id);
  const upstreamSet = new Set(upstreamIds);
  const existingRows = dependencies.sqlite.prepare(`
    SELECT model_id AS modelId, synced FROM models WHERE provider_id = ?
  `).all(provider.id) as Array<{ modelId: string; synced: number }>;
  const existingIds = new Set(existingRows.map((model) => model.modelId));
  const observedAt = dependencies.now();
  let added = 0;
  let removed = 0;
  let keptManual = 0;
  let keptReferenced = 0;
  let repriced = 0;

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
        pricing_source, pricing_source_ref, pricing_synced_at, capabilities_json,
        pricing_tiers_json, pricing_currency, reasoning_json
      ) VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    /**
     * 没有官方价格接口的服务商：同步时把当前 cc-switch 打包价重新套一遍，
     * 这样「同步模型」对所有服务商都顺带刷新价格，语义一致。
     *
     * WHERE 里的来源白名单和开机重算用的是同一条规则（见 pricing-migration.ts）：
     * 只改 cc-switch 自己写下的行，manual / subscription / 厂商官方价一律不碰，
     * 否则同步和开机重算会互相打架。
     */
    const repriceBundled = dependencies.sqlite.prepare(`
      UPDATE models SET
        input_price = ?, output_price = ?, cache_read_price = ?, cache_write_price = ?,
        pricing_source = ?, pricing_source_ref = ?, pricing_synced_at = ?
      WHERE provider_id = ? AND model_id = ?
        AND COALESCE(pricing_source, '') IN (${CC_SWITCH_OWNED_PRICING_SOURCES.map(() => '?').join(', ')})
    `);

    const fillMissingOfficialMetadata = dependencies.sqlite.prepare(`
      UPDATE models
      -- display_name 是标签，用户可能改过，只在空时填。
      SET display_name = COALESCE(display_name, ?),
          -- context_window 是模型事实而非偏好：上游改了就得跟，
          -- 存着过期值会在界面上显示错误的上下文长度（实测 k3 上游 1M、本地存 256k）。
          context_window = COALESCE(?, context_window),
          capabilities_json = COALESCE(?, capabilities_json),
          reasoning_json = COALESCE(?, reasoning_json),
          pricing_tiers_json = CASE WHEN COALESCE(pricing_source, '') = 'manual'
                                    THEN pricing_tiers_json ELSE COALESCE(?, pricing_tiers_json) END,
          pricing_currency = CASE WHEN COALESCE(pricing_source, '') = 'manual'
                                  THEN pricing_currency ELSE COALESCE(?, pricing_currency) END,
          input_price = CASE WHEN COALESCE(pricing_source, '') = 'manual'
                             THEN input_price ELSE COALESCE(?, input_price) END,
          output_price = CASE WHEN COALESCE(pricing_source, '') = 'manual'
                              THEN output_price ELSE COALESCE(?, output_price) END,
          cache_read_price = CASE WHEN COALESCE(pricing_source, '') = 'manual'
                                  THEN cache_read_price ELSE COALESCE(?, cache_read_price) END,
          pricing_source = CASE WHEN ? IS NOT NULL AND COALESCE(pricing_source, '') <> 'manual'
                                THEN 'aliyun-modelstudio' ELSE pricing_source END
      WHERE provider_id = ? AND model_id = ?
    `);
    for (const model of upstreamModels) {
      if (existingIds.has(model.id)) {
        if (officialCatalog) {
          fillMissingOfficialMetadata.run(
            model.displayName,
            model.contextWindow,
            model.capabilitiesJson ?? null,
            model.reasoningJson ?? null,
            model.pricingTiersJson ?? null,
            model.pricingCurrency ?? null,
            model.officialInput ?? null,
            model.officialOutput ?? null,
            model.officialCacheRead ?? null,
            model.pricingTiersJson ?? null,
            provider.id,
            model.id,
          );
        }
        // 百炼有官方价格，不能回退 cc-switch；其余服务商（含 Kimi）照常刷新打包价。
        if (!bailianCatalog) {
          const fresh = dependencies.lookupPricing(requestProvider.baseUrl, requestProvider.protocol, model.id);
          const changed = repriceBundled.run(
            fresh?.input ?? null, fresh?.output ?? null, fresh?.cacheRead ?? null, fresh?.cacheWrite ?? null,
            fresh?.source ?? null,
            fresh ? dependencies.pricingSourceRef : null,
            fresh ? observedAt : null,
            provider.id, model.id,
            ...CC_SWITCH_OWNED_PRICING_SOURCES,
          ).changes;
          if (changed > 0) repriced++;
        }
        continue;
      }
      const pricing = bailianCatalog ? null : dependencies.lookupPricing(requestProvider.baseUrl, requestProvider.protocol, model.id);
      insert.run(
        dependencies.randomId(), provider.id, model.id, model.displayName, model.contextWindow,
        // 官方单价（单档且单位可识别时）优先于 cc-switch 打包价。
        pricing?.input ?? model.officialInput ?? null,
        pricing?.output ?? model.officialOutput ?? null,
        pricing?.cacheRead ?? model.officialCacheRead ?? null,
        pricing?.cacheWrite ?? null,
        pricing?.source ?? (model.pricingTiersJson ? 'aliyun-modelstudio' : null),
        pricing ? dependencies.pricingSourceRef : null,
        pricing || model.pricingTiersJson ? observedAt : null,
        model.capabilitiesJson ?? null,
        model.pricingTiersJson ?? null,
        model.pricingCurrency ?? null,
        model.reasoningJson ?? null,
      );
      added++;
    }
    if (options?.prune) {
      // 被路由别名指向的模型不能删——删了别名会直接指向不存在的模型。
      const referenced = new Set<string>();
      for (const row of dependencies.sqlite.prepare('SELECT targets FROM route_aliases').all() as Array<{ targets: string }>) {
        let targets: unknown;
        try {
          targets = JSON.parse(row.targets);
        } catch {
          throw new Error('存在无法解析的路由别名，请先修复后再同步');
        }
        if (!Array.isArray(targets)) continue;
        for (const target of targets) {
          const t = target as { provider_id?: unknown; model_id?: unknown } | null;
          if (t?.provider_id === provider.id && typeof t.model_id === 'string') referenced.add(t.model_id);
        }
      }
      const remove = dependencies.sqlite.prepare('DELETE FROM models WHERE provider_id = ? AND model_id = ?');
      for (const row of existingRows) {
        if (upstreamSet.has(row.modelId)) continue;
        // 手动添加的行不属于同步集合，同步无权删除。
        if (row.synced !== 1) { keptManual++; continue; }
        if (referenced.has(row.modelId)) { keptReferenced++; continue; }
        remove.run(provider.id, row.modelId);
        removed++;
      }
    }
    replaceEndpointModelCatalogInTransaction(dependencies.sqlite, endpointSnapshot.id, upstreamIds, observedAt, !bailianCatalog);
  })();

  return {
    added,
    existing: upstreamIds.length - added,
    removed_not_in_upstream: existingRows.filter((model) => model.synced === 1 && !upstreamSet.has(model.modelId)).length,
    total_upstream: upstreamIds.length,
    removed,
    kept_manual: keptManual,
    kept_referenced: keptReferenced,
    repriced,
  };
}
