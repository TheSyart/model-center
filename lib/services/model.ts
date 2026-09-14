import crypto from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { db, schema, sqlite } from '@/lib/db';
import type { models } from '@/lib/db/schema';
import { getProviderSubscriptionId, withDefaultProviderEndpoint, type ProviderRow } from './provider';
import { CC_SWITCH_PRICING_SOURCE_REF, lookupBundledPricing } from './model-pricing';
import { syncProviderModels, type SyncResult } from './model-sync';
import { addManualModelsToCompleteCatalog } from '@/lib/subscriptions/store';

export type { SyncResult } from './model-sync';

export type ModelRow = typeof models.$inferSelect;

export function serializeModel(m: ModelRow) {
  return {
    id: m.id,
    provider_id: m.providerId,
    model_id: m.modelId,
    alias: m.alias,
    display_name: m.displayName,
    enabled: m.enabled === 1,
    input_price: m.inputPrice,
    output_price: m.outputPrice,
    cache_read_price: m.cacheReadPrice,
    cache_write_price: m.cacheWritePrice,
    pricing_source: m.pricingSource,
    pricing_source_ref: m.pricingSourceRef,
    pricing_synced_at: m.pricingSyncedAt,
    context_window: m.contextWindow,
    synced: m.synced === 1,
  };
}

export function listModels(providerId?: string): ModelRow[] {
  const query = db.select().from(schema.models).orderBy(asc(schema.models.modelId));
  return (providerId ? query.where(eq(schema.models.providerId, providerId)) : query).all();
}

export function getModelById(id: string): ModelRow | undefined {
  return db.select().from(schema.models).where(eq(schema.models.id, id)).get();
}

/** alias 全局唯一性检查（models.alias 与 route_aliases.alias 共用一个命名空间，路由解析时别名优先）。 */
export function aliasTaken(alias: string, excludeModelId?: string): boolean {
  const inModels = db
    .select()
    .from(schema.models)
    .where(eq(schema.models.alias, alias))
    .all()
    .some((m) => m.id !== excludeModelId);
  if (inModels) return true;
  return !!db.select().from(schema.routeAliases).where(eq(schema.routeAliases.alias, alias)).get();
}

export interface ModelInput {
  provider_id: string;
  model_id: string;
  alias?: string | null;
  display_name?: string | null;
  enabled?: boolean;
  input_price?: number | null;
  output_price?: number | null;
  cache_read_price?: number | null;
  cache_write_price?: number | null;
  context_window?: number | null;
}

/** 创建手动模型（synced=0）；冲突返回 'conflict'（同 provider 同名）或 'alias_conflict'。 */
export function createModel(input: ModelInput): ModelRow | 'conflict' | 'alias_conflict' {
  if (input.alias && aliasTaken(input.alias)) return 'alias_conflict';
  const provider = db.select().from(schema.providers).where(eq(schema.providers.id, input.provider_id)).get();
  const hasManualPricing =
    input.input_price !== undefined ||
    input.output_price !== undefined ||
    input.cache_read_price !== undefined ||
    input.cache_write_price !== undefined;
  // 订阅账号的调用不计 API 金额，不套用内置 API 定价
  const subscription = !!getProviderSubscriptionId(input.provider_id);
  const pricedProvider = provider && !subscription ? withDefaultProviderEndpoint(provider) : undefined;
  const bundled = !hasManualPricing && pricedProvider
    ? lookupBundledPricing(pricedProvider.baseUrl, pricedProvider.protocol, input.model_id)
    : null;
  const row: ModelRow = {
    id: crypto.randomUUID(),
    providerId: input.provider_id,
    modelId: input.model_id,
    alias: input.alias || null,
    displayName: input.display_name || null,
    enabled: input.enabled === false ? 0 : 1,
    inputPrice: hasManualPricing ? (input.input_price ?? null) : (bundled?.input ?? null),
    outputPrice: hasManualPricing ? (input.output_price ?? null) : (bundled?.output ?? null),
    cacheReadPrice: hasManualPricing ? (input.cache_read_price ?? null) : (bundled?.cacheRead ?? null),
    cacheWritePrice: hasManualPricing ? (input.cache_write_price ?? null) : (bundled?.cacheWrite ?? null),
    pricingSource: subscription ? 'subscription' : hasManualPricing ? 'manual' : (bundled?.source ?? null),
    pricingSourceRef: bundled ? CC_SWITCH_PRICING_SOURCE_REF : null,
    pricingSyncedAt: bundled ? Date.now() : null,
    contextWindow: input.context_window ?? null,
    synced: 0,
    reasoningJson: null,
  };
  try {
    db.insert(schema.models).values(row).run();
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) return 'conflict';
    throw e;
  }
  addManualModelsToCompleteCatalog(sqlite, row.providerId, [row.modelId], Date.now());
  return row;
}

/** 更新；不存在返回 null，alias 冲突返回 'alias_conflict'。 */
export function updateModel(
  id: string,
  input: Partial<Omit<ModelInput, 'provider_id' | 'model_id'>>,
): ModelRow | null | 'alias_conflict' {
  const existing = getModelById(id);
  if (!existing) return null;
  if (input.alias && aliasTaken(input.alias, id)) return 'alias_conflict';
  const updates: Record<string, unknown> = {};
  if (input.alias !== undefined) updates.alias = input.alias || null;
  if (input.display_name !== undefined) updates.displayName = input.display_name || null;
  if (input.enabled !== undefined) updates.enabled = input.enabled ? 1 : 0;
  if (input.input_price !== undefined) updates.inputPrice = input.input_price;
  if (input.output_price !== undefined) updates.outputPrice = input.output_price;
  if (input.cache_read_price !== undefined) updates.cacheReadPrice = input.cache_read_price;
  if (input.cache_write_price !== undefined) updates.cacheWritePrice = input.cache_write_price;
  if (
    input.input_price !== undefined ||
    input.output_price !== undefined ||
    input.cache_read_price !== undefined ||
    input.cache_write_price !== undefined
  ) {
    updates.pricingSource = 'manual';
    updates.pricingSourceRef = null;
    updates.pricingSyncedAt = null;
  }
  if (input.context_window !== undefined) updates.contextWindow = input.context_window;
  db.update(schema.models).set(updates).where(eq(schema.models.id, id)).run();
  return getModelById(id)!;
}

export function restoreModelPricing(id: string): ModelRow | null {
  const existing = getModelById(id);
  if (!existing) return null;
  const provider = db.select().from(schema.providers).where(eq(schema.providers.id, existing.providerId)).get();
  if (!provider) return null;
  const defaultProvider = withDefaultProviderEndpoint(provider);
  const pricing = lookupBundledPricing(defaultProvider.baseUrl, defaultProvider.protocol, existing.modelId);
  db.update(schema.models)
    .set({
      inputPrice: pricing?.input ?? null,
      outputPrice: pricing?.output ?? null,
      cacheReadPrice: pricing?.cacheRead ?? null,
      cacheWritePrice: pricing?.cacheWrite ?? null,
      pricingSource: pricing?.source ?? null,
      pricingSourceRef: pricing ? CC_SWITCH_PRICING_SOURCE_REF : null,
      pricingSyncedAt: pricing ? Date.now() : null,
    })
    .where(eq(schema.models.id, id))
    .run();
  return getModelById(id)!;
}

export function deleteModel(id: string): boolean {
  if (!getModelById(id)) return false;
  db.delete(schema.models).where(eq(schema.models.id, id)).run();
  return true;
}

// ---------- 模型同步（F4） ----------

export interface TestResult {
  ok: boolean;
  latency_ms: number;
  status?: number;
  error?: string;
}

/** 连通性测速（F10）：向 provider 模型列表端点发一次轻量 GET，测延迟与可用性。 */
export async function testProviderConnection(provider: ProviderRow, apiKey: string): Promise<TestResult> {
  provider = withDefaultProviderEndpoint(provider);
  const base = provider.baseUrl.replace(/\/+$/, '');
  let url: string;
  let headers: Record<string, string>;
  if (provider.protocol === 'gemini') {
    url = `${base}/v1beta/models`;
    headers = { 'x-goog-api-key': apiKey };
  } else if (provider.protocol === 'anthropic') {
    url = `${base}/v1/models`;
    headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  } else {
    url = `${base}/models`;
    headers = { Authorization: `Bearer ${apiKey}` };
  }
  const start = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    const latency = Date.now() - start;
    if (!res.ok) {
      const text = (await res.text()).slice(0, 200);
      return { ok: false, latency_ms: latency, status: res.status, error: text || `HTTP ${res.status}` };
    }
    return { ok: true, latency_ms: latency, status: res.status };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 同步上游模型列表并合并入库：
 * 新模型插入（synced=1）；已有 synced=1 但上游消失的不删除（保留 enabled 状态，仅报告数量）；
 * 手动添加的（synced=0）不动。
 */
export async function syncModels(provider: ProviderRow, apiKey: string): Promise<SyncResult> {
  return syncProviderModels(provider, apiKey, {
    sqlite,
    fetch,
    lookupPricing: lookupBundledPricing,
    randomId: crypto.randomUUID,
    pricingSourceRef: CC_SWITCH_PRICING_SOURCE_REF,
    now: Date.now,
  });
}
