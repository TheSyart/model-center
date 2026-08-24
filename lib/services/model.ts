import crypto from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { models } from '@/lib/db/schema';
import type { ProviderRow } from './provider';
import { CC_SWITCH_PRICING_SOURCE_REF, lookupBundledPricing } from './model-pricing';

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
  const bundled = !hasManualPricing && provider
    ? lookupBundledPricing(provider.baseUrl, provider.protocol, input.model_id)
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
    pricingSource: hasManualPricing ? 'manual' : (bundled?.source ?? null),
    pricingSourceRef: bundled ? CC_SWITCH_PRICING_SOURCE_REF : null,
    pricingSyncedAt: bundled ? Date.now() : null,
    contextWindow: input.context_window ?? null,
    synced: 0,
  };
  try {
    db.insert(schema.models).values(row).run();
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) return 'conflict';
    throw e;
  }
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
  const pricing = lookupBundledPricing(provider.baseUrl, provider.protocol, existing.modelId);
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

const SYNC_TIMEOUT_MS = 30_000;

/** 按 provider.protocol 调上游模型列表端点，返回 model_id 列表。 */
async function fetchUpstreamModels(provider: ProviderRow, apiKey: string): Promise<string[]> {
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
    // openai / openai-responses
    url = `${base}/models`;
    headers = { Authorization: `Bearer ${apiKey}` };
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(SYNC_TIMEOUT_MS) });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new Error(`上游返回 ${res.status}: ${text}`);
  }
  const json = (await res.json()) as Record<string, any>;
  let ids: string[];
  if (provider.protocol === 'gemini') {
    // { models: [{ name: "models/xxx", ... }] }
    ids = ((json.models as any[]) ?? []).map((m) => String(m.name ?? '').replace(/^models\//, '')).filter(Boolean);
  } else {
    // openai / anthropic: { data: [{ id: "xxx" }] }
    ids = ((json.data as any[]) ?? []).map((m) => String(m.id ?? '')).filter(Boolean);
  }
  return [...new Set(ids)];
}

export interface SyncResult {
  added: number;
  existing: number;
  /** 上游已消失的同步模型数量（保留不删，仅报告） */
  removed_not_in_upstream: number;
  total_upstream: number;
}

/**
 * 同步上游模型列表并合并入库：
 * 新模型插入（synced=1）；已有 synced=1 但上游消失的不删除（保留 enabled 状态，仅报告数量）；
 * 手动添加的（synced=0）不动。
 */
export async function syncModels(provider: ProviderRow, apiKey: string): Promise<SyncResult> {
  const upstreamIds = await fetchUpstreamModels(provider, apiKey);
  const upstreamSet = new Set(upstreamIds);
  const existingRows = listModels(provider.id);
  const existingIds = new Set(existingRows.map((m) => m.modelId));

  let added = 0;
  for (const modelId of upstreamIds) {
    if (existingIds.has(modelId)) continue;
    const pricing = lookupBundledPricing(provider.baseUrl, provider.protocol, modelId);
    db.insert(schema.models)
      .values({
        id: crypto.randomUUID(), providerId: provider.id, modelId, enabled: 1, synced: 1,
        inputPrice: pricing?.input ?? null,
        outputPrice: pricing?.output ?? null,
        cacheReadPrice: pricing?.cacheRead ?? null,
        cacheWritePrice: pricing?.cacheWrite ?? null,
        pricingSource: pricing?.source ?? null,
        pricingSourceRef: pricing ? CC_SWITCH_PRICING_SOURCE_REF : null,
        pricingSyncedAt: pricing ? Date.now() : null,
      })
      .run();
    added++;
  }
  const removedNotInUpstream = existingRows.filter((m) => m.synced === 1 && !upstreamSet.has(m.modelId)).length;
  return {
    added,
    existing: upstreamIds.length - added,
    removed_not_in_upstream: removedNotInUpstream,
    total_upstream: upstreamIds.length,
  };
}
