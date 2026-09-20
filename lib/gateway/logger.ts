import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema, sqlite } from '@/lib/db';
import { maybePurgeExpiredLogs } from '@/lib/services/log';
import { detectRequestClient, effectiveTokenTotal, normalizeRequestSource, type UsageInfo } from '@/lib/services/usage-metrics';
import { calculateRequestCost } from '@/lib/services/pricing';

export interface RequestLogFields {
  ts: number;
  providerId: string | null;
  modelId: string | null;
  alias: string | null;
  /** 本次请求注入的提示词 id（若有） */
  promptId?: string | null;
  /** 本次调用使用的网关令牌 id */
  tokenId?: string | null;
  tokenName?: string | null;
  tokenPrefix?: string | null;
  entryProtocol: 'openai' | 'anthropic' | 'responses';
  /** 实际选中的上游端点，允许历史日志为空。 */
  providerEndpointId?: string | null;
  /** 实际请求上游所用协议；入口协议继续单独保留。 */
  upstreamProtocol?: string | null;
  source?: string | null;
  status: number;
  latencyMs: number;
  firstTokenMs?: number | null;
  durationMs?: number | null;
  usage: UsageInfo | null;
  error: string | null;
  stream: boolean;
}

/** 按 models 表的自定义单价估算成本（每百万 token 单价 → 美元）。 */
function estimateCost(providerId: string | null, modelId: string | null, usage: UsageInfo | null): number | null {
  if (!providerId || !modelId || !usage) return null;
  if (sqlite.prepare('SELECT 1 FROM subscription_provider_links WHERE provider_id=?').get(providerId)) return null;
  const m = db
    .select()
    .from(schema.models)
    .where(and(eq(schema.models.providerId, providerId), eq(schema.models.modelId, modelId)))
    .get();
  if (!m) return null;
  return calculateRequestCost({
    usage,
    pricing: {
      input: m.inputPrice,
      output: m.outputPrice,
      cacheRead: m.cacheReadPrice,
      cacheWrite: m.cacheWritePrice,
      currency: m.pricingCurrency,
    },
  });
}

/**
 * 写请求日志（§6 request_logs）。只记元数据与错误摘要，不记请求/响应体（§10）。
 * 同步写入（better-sqlite3 为同步驱动），调用方负责在响应返回后调用（after()）。
 * 日志失败不影响网关主流程。
 */
export function writeRequestLog(f: RequestLogFields): void {
  try {
    const cost = estimateCost(f.providerId, f.modelId, f.usage);
    const provider = f.providerId
      ? db.select().from(schema.providers).where(eq(schema.providers.id, f.providerId)).get()
      : null;
    const date = new Date(f.ts);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const observed = f.usage?.cache_metrics_observed === true;
    const durationMs = f.durationMs ?? f.latencyMs;
    const source = normalizeRequestSource(f.source);
    const client = detectRequestClient(source);

    db.transaction((tx) => {
      tx.insert(schema.requestLogs)
        .values({
          id: crypto.randomUUID(),
          ts: f.ts,
          providerId: f.providerId,
          modelId: f.modelId,
          alias: f.alias,
          promptId: f.promptId ?? null,
          tokenId: f.tokenId ?? null,
          tokenName: f.tokenName ?? null,
          tokenPrefix: f.tokenPrefix ?? null,
          entryProtocol: f.entryProtocol,
          providerEndpointId: f.providerEndpointId ?? null,
          upstreamProtocol: f.upstreamProtocol ?? null,
          source,
          clientKey: client.key,
          clientName: client.name,
          status: f.status,
          latencyMs: f.latencyMs,
          firstTokenMs: f.firstTokenMs ?? null,
          durationMs,
          promptTokens: f.usage?.prompt_tokens ?? null,
          completionTokens: f.usage?.completion_tokens ?? null,
          totalTokens: f.usage?.total_tokens ?? null,
          uncachedInputTokens: f.usage?.uncached_input_tokens ?? null,
          cacheReadTokens: f.usage?.cache_read_tokens ?? null,
          cacheWriteTokens: f.usage?.cache_write_tokens ?? null,
          cacheMetricsObserved: observed ? 1 : 0,
          cost,
          error: f.error ? f.error.slice(0, 500) : null,
          stream: f.stream ? 1 : 0,
        })
        .run();

      tx.run(sql`
        INSERT INTO usage_daily (
          id, day, token_id, token_name, token_prefix,
          provider_id, provider_name, provider_slug, model_id, entry_protocol,
          requests, success, input_tokens, uncached_input_tokens, output_tokens,
          cache_read_tokens, cache_write_tokens, effective_tokens,
          cost, priced_requests, duration_total_ms, duration_count,
          first_token_total_ms, first_token_count, cache_observed_requests
        ) VALUES (
          ${crypto.randomUUID()}, ${day}, ${f.tokenId ?? ''}, ${f.tokenName ?? null}, ${f.tokenPrefix ?? null},
          ${f.providerId ?? ''}, ${provider?.name ?? null}, ${provider?.slug ?? null}, ${f.modelId ?? ''}, ${f.entryProtocol},
          1, ${f.status >= 200 && f.status < 300 ? 1 : 0},
          ${observed ? (f.usage?.uncached_input_tokens ?? 0) : (f.usage?.prompt_tokens ?? 0)},
          ${observed ? (f.usage?.uncached_input_tokens ?? 0) : 0},
          ${f.usage?.completion_tokens ?? 0}, ${f.usage?.cache_read_tokens ?? 0}, ${f.usage?.cache_write_tokens ?? 0},
          ${effectiveTokenTotal(f.usage)}, ${cost ?? 0}, ${cost == null ? 0 : 1}, ${durationMs}, 1,
          ${f.firstTokenMs ?? 0}, ${f.firstTokenMs == null ? 0 : 1}, ${observed ? 1 : 0}
        )
        ON CONFLICT(day, token_id, provider_id, model_id, entry_protocol) DO UPDATE SET
          token_name = COALESCE(excluded.token_name, usage_daily.token_name),
          token_prefix = COALESCE(excluded.token_prefix, usage_daily.token_prefix),
          provider_name = COALESCE(excluded.provider_name, usage_daily.provider_name),
          provider_slug = COALESCE(excluded.provider_slug, usage_daily.provider_slug),
          requests = usage_daily.requests + 1,
          success = usage_daily.success + excluded.success,
          input_tokens = usage_daily.input_tokens + excluded.input_tokens,
          uncached_input_tokens = usage_daily.uncached_input_tokens + excluded.uncached_input_tokens,
          output_tokens = usage_daily.output_tokens + excluded.output_tokens,
          cache_read_tokens = usage_daily.cache_read_tokens + excluded.cache_read_tokens,
          cache_write_tokens = usage_daily.cache_write_tokens + excluded.cache_write_tokens,
          effective_tokens = usage_daily.effective_tokens + excluded.effective_tokens,
          cost = usage_daily.cost + excluded.cost,
          priced_requests = usage_daily.priced_requests + excluded.priced_requests,
          duration_total_ms = usage_daily.duration_total_ms + excluded.duration_total_ms,
          duration_count = usage_daily.duration_count + excluded.duration_count,
          first_token_total_ms = usage_daily.first_token_total_ms + excluded.first_token_total_ms,
          first_token_count = usage_daily.first_token_count + excluded.first_token_count,
          cache_observed_requests = usage_daily.cache_observed_requests + excluded.cache_observed_requests
      `);
    });
    // 顺带按 1% 概率清理过期日志（log_retention_days，默认 30 天）
    maybePurgeExpiredLogs();
  } catch (e) {
    console.error('[gateway] 写请求日志失败:', e);
  }
}
