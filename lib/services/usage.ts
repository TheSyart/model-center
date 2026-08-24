import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { cacheHitRate, fillDailyActivity, type ActivityDay, type UsageBucket } from '@/lib/services/usage-metrics';

export interface UsageFilters {
  from: number;
  to: number;
  bucket: UsageBucket;
  token?: string;
  provider?: string;
  model?: string;
}

interface AggregateRow {
  requests: number | null;
  success: number | null;
  input_tokens: number | null;
  uncached_input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  effective_tokens: number | null;
  cost: number | null;
  priced_requests: number | null;
  duration_total_ms: number | null;
  duration_count: number | null;
  first_token_total_ms: number | null;
  first_token_count: number | null;
  cache_observed_requests: number | null;
}

export interface UsageAggregate {
  requests: number;
  success: number;
  success_rate: number | null;
  effective_tokens: number;
  input_tokens: number;
  uncached_input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cache_hit_rate: number | null;
  cost: number;
  priced_requests: number;
  avg_duration_ms: number | null;
  avg_first_token_ms: number | null;
  cache_coverage: number | null;
}

export interface UsageTrendPoint {
  start: string;
  requests: number;
  effective_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost: number;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

function localDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localHour(timestamp: number): string {
  const date = new Date(timestamp);
  return `${localDay(timestamp)}T${String(date.getHours()).padStart(2, '0')}:00`;
}

function rawWhere(filters: UsageFilters) {
  return sql`
    l.ts >= ${filters.from} AND l.ts < ${filters.to}
    AND (${filters.token ? sql`l.token_id = ${filters.token}` : sql`1=1`})
    AND (${filters.provider ? sql`l.provider_id = ${filters.provider}` : sql`1=1`})
    AND (${filters.model ? sql`l.model_id = ${filters.model}` : sql`1=1`})
  `;
}

function dailyWhere(filters: Pick<UsageFilters, 'token' | 'provider' | 'model'>, fromDay: string, toDay: string) {
  return sql`
    d.day >= ${fromDay} AND d.day <= ${toDay}
    AND (${filters.token ? sql`d.token_id = ${filters.token}` : sql`1=1`})
    AND (${filters.provider ? sql`d.provider_id = ${filters.provider}` : sql`1=1`})
    AND (${filters.model ? sql`d.model_id = ${filters.model}` : sql`1=1`})
  `;
}

function rawAggregateSelect() {
  return sql`
    COUNT(*) AS requests,
    SUM(CASE WHEN l.status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS success,
    COALESCE(SUM(CASE WHEN l.cache_metrics_observed = 1 THEN l.uncached_input_tokens ELSE l.prompt_tokens END), 0) AS input_tokens,
    COALESCE(SUM(CASE WHEN l.cache_metrics_observed = 1 THEN l.uncached_input_tokens ELSE 0 END), 0) AS uncached_input_tokens,
    COALESCE(SUM(l.completion_tokens), 0) AS output_tokens,
    COALESCE(SUM(l.cache_read_tokens), 0) AS cache_read_tokens,
    COALESCE(SUM(l.cache_write_tokens), 0) AS cache_write_tokens,
    COALESCE(SUM(CASE WHEN l.cache_metrics_observed = 1
      THEN COALESCE(l.uncached_input_tokens, 0) + COALESCE(l.completion_tokens, 0)
        + COALESCE(l.cache_read_tokens, 0) + COALESCE(l.cache_write_tokens, 0)
      ELSE COALESCE(l.total_tokens, 0) END), 0) AS effective_tokens,
    COALESCE(SUM(l.cost), 0) AS cost,
    SUM(CASE WHEN l.cost IS NOT NULL THEN 1 ELSE 0 END) AS priced_requests,
    COALESCE(SUM(COALESCE(l.duration_ms, l.latency_ms)), 0) AS duration_total_ms,
    SUM(CASE WHEN l.duration_ms IS NOT NULL OR l.latency_ms IS NOT NULL THEN 1 ELSE 0 END) AS duration_count,
    COALESCE(SUM(l.first_token_ms), 0) AS first_token_total_ms,
    SUM(CASE WHEN l.first_token_ms IS NOT NULL THEN 1 ELSE 0 END) AS first_token_count,
    SUM(CASE WHEN l.cache_metrics_observed = 1 THEN 1 ELSE 0 END) AS cache_observed_requests
  `;
}

function dailyAggregateSelect() {
  return sql`
    COALESCE(SUM(d.requests), 0) AS requests,
    COALESCE(SUM(d.success), 0) AS success,
    COALESCE(SUM(d.input_tokens), 0) AS input_tokens,
    COALESCE(SUM(d.uncached_input_tokens), 0) AS uncached_input_tokens,
    COALESCE(SUM(d.output_tokens), 0) AS output_tokens,
    COALESCE(SUM(d.cache_read_tokens), 0) AS cache_read_tokens,
    COALESCE(SUM(d.cache_write_tokens), 0) AS cache_write_tokens,
    COALESCE(SUM(d.effective_tokens), 0) AS effective_tokens,
    COALESCE(SUM(d.cost), 0) AS cost,
    COALESCE(SUM(d.priced_requests), 0) AS priced_requests,
    COALESCE(SUM(d.duration_total_ms), 0) AS duration_total_ms,
    COALESCE(SUM(d.duration_count), 0) AS duration_count,
    COALESCE(SUM(d.first_token_total_ms), 0) AS first_token_total_ms,
    COALESCE(SUM(d.first_token_count), 0) AS first_token_count,
    COALESCE(SUM(d.cache_observed_requests), 0) AS cache_observed_requests
  `;
}

function serializeAggregate(row: AggregateRow | undefined): UsageAggregate {
  const number = (value: number | null | undefined) => Number(value ?? 0);
  const requests = number(row?.requests);
  const success = number(row?.success);
  const input = number(row?.input_tokens);
  const uncachedInput = number(row?.uncached_input_tokens);
  const cacheRead = number(row?.cache_read_tokens);
  const durationCount = number(row?.duration_count);
  const firstTokenCount = number(row?.first_token_count);
  const observed = number(row?.cache_observed_requests);
  return {
    requests,
    success,
    success_rate: requests > 0 ? success / requests : null,
    effective_tokens: number(row?.effective_tokens),
    input_tokens: input,
    uncached_input_tokens: uncachedInput,
    output_tokens: number(row?.output_tokens),
    cache_read_tokens: cacheRead,
    cache_write_tokens: number(row?.cache_write_tokens),
    cache_hit_rate: cacheHitRate(uncachedInput, cacheRead, observed),
    cost: number(row?.cost),
    priced_requests: number(row?.priced_requests),
    avg_duration_ms: durationCount > 0 ? number(row?.duration_total_ms) / durationCount : null,
    avg_first_token_ms: firstTokenCount > 0 ? number(row?.first_token_total_ms) / firstTokenCount : null,
    cache_coverage: requests > 0 ? observed / requests : null,
  };
}

function fillTrend(rows: UsageTrendPoint[], filters: UsageFilters): UsageTrendPoint[] {
  const map = new Map(rows.map((row) => [row.start, row]));
  const step = filters.bucket === 'hour' ? HOUR : DAY;
  const startDate = new Date(filters.from);
  const cursor =
    filters.bucket === 'hour'
      ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startDate.getHours()).getTime()
      : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const points: UsageTrendPoint[] = [];
  for (let timestamp = cursor; timestamp < filters.to; timestamp += step) {
    const key = filters.bucket === 'hour' ? localHour(timestamp) : localDay(timestamp);
    points.push(
      map.get(key) ?? {
        start: key,
        requests: 0,
        effective_tokens: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        cost: 0,
      },
    );
  }
  return points;
}

function queryRaw(filters: UsageFilters) {
  const where = rawWhere(filters);
  const overview = db.get<AggregateRow>(sql`SELECT ${rawAggregateSelect()} FROM request_logs l WHERE ${where}`);
  const byToken = db.all<AggregateRow & { token_id: string | null; token_name: string | null; token_prefix: string | null }>(sql`
    SELECT l.token_id, COALESCE(MAX(l.token_name), MAX(t.name)) AS token_name,
      COALESCE(MAX(l.token_prefix), MAX(t.prefix)) AS token_prefix, ${rawAggregateSelect()}
    FROM request_logs l LEFT JOIN gateway_tokens t ON t.id = l.token_id
    WHERE ${where} GROUP BY l.token_id ORDER BY effective_tokens DESC
  `);
  const byProvider = db.all<AggregateRow & { provider_id: string | null; provider_name: string | null; provider_slug: string | null }>(sql`
    SELECT l.provider_id, MAX(p.name) AS provider_name, MAX(p.slug) AS provider_slug, ${rawAggregateSelect()}
    FROM request_logs l LEFT JOIN providers p ON p.id = l.provider_id
    WHERE ${where} GROUP BY l.provider_id ORDER BY effective_tokens DESC
  `);
  const byModel = db.all<AggregateRow & { provider_id: string | null; provider_slug: string | null; model_id: string | null }>(sql`
    SELECT l.provider_id, MAX(p.slug) AS provider_slug, l.model_id, ${rawAggregateSelect()}
    FROM request_logs l LEFT JOIN providers p ON p.id = l.provider_id
    WHERE ${where} GROUP BY l.provider_id, l.model_id ORDER BY effective_tokens DESC
  `);
  const trendRows = db.all<UsageTrendPoint>(sql`
    SELECT strftime('%Y-%m-%dT%H:00', l.ts / 1000, 'unixepoch', 'localtime') AS start,
      COUNT(*) AS requests,
      COALESCE(SUM(CASE WHEN l.cache_metrics_observed = 1
        THEN COALESCE(l.uncached_input_tokens, 0) + COALESCE(l.completion_tokens, 0)
          + COALESCE(l.cache_read_tokens, 0) + COALESCE(l.cache_write_tokens, 0)
        ELSE COALESCE(l.total_tokens, 0) END), 0) AS effective_tokens,
      COALESCE(SUM(CASE WHEN l.cache_metrics_observed = 1 THEN l.uncached_input_tokens ELSE l.prompt_tokens END), 0) AS input_tokens,
      COALESCE(SUM(l.completion_tokens), 0) AS output_tokens,
      COALESCE(SUM(l.cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(SUM(l.cache_write_tokens), 0) AS cache_write_tokens,
      COALESCE(SUM(l.cost), 0) AS cost
    FROM request_logs l WHERE ${where} GROUP BY start ORDER BY start
  `);
  return { overview, byToken, byProvider, byModel, trendRows };
}

function queryDaily(filters: UsageFilters) {
  const fromDay = localDay(filters.from);
  const toDay = localDay(filters.to - 1);
  const where = dailyWhere(filters, fromDay, toDay);
  const overview = db.get<AggregateRow>(sql`SELECT ${dailyAggregateSelect()} FROM usage_daily d WHERE ${where}`);
  const byToken = db.all<AggregateRow & { token_id: string; token_name: string | null; token_prefix: string | null }>(sql`
    SELECT d.token_id, MAX(d.token_name) AS token_name, MAX(d.token_prefix) AS token_prefix, ${dailyAggregateSelect()}
    FROM usage_daily d WHERE ${where} GROUP BY d.token_id ORDER BY effective_tokens DESC
  `);
  const byProvider = db.all<AggregateRow & { provider_id: string; provider_name: string | null; provider_slug: string | null }>(sql`
    SELECT d.provider_id, MAX(d.provider_name) AS provider_name, MAX(d.provider_slug) AS provider_slug, ${dailyAggregateSelect()}
    FROM usage_daily d WHERE ${where} GROUP BY d.provider_id ORDER BY effective_tokens DESC
  `);
  const byModel = db.all<AggregateRow & { provider_id: string; provider_slug: string | null; model_id: string }>(sql`
    SELECT d.provider_id, MAX(d.provider_slug) AS provider_slug, d.model_id, ${dailyAggregateSelect()}
    FROM usage_daily d WHERE ${where} GROUP BY d.provider_id, d.model_id ORDER BY effective_tokens DESC
  `);
  const trendRows = db.all<UsageTrendPoint>(sql`
    SELECT d.day AS start, COALESCE(SUM(d.requests), 0) AS requests,
      COALESCE(SUM(d.effective_tokens), 0) AS effective_tokens,
      COALESCE(SUM(d.input_tokens), 0) AS input_tokens,
      COALESCE(SUM(d.output_tokens), 0) AS output_tokens,
      COALESCE(SUM(d.cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(SUM(d.cache_write_tokens), 0) AS cache_write_tokens,
      COALESCE(SUM(d.cost), 0) AS cost
    FROM usage_daily d WHERE ${where} GROUP BY d.day ORDER BY d.day
  `);
  return { overview, byToken, byProvider, byModel, trendRows };
}

export function getUsage(filters: UsageFilters) {
  const result = filters.bucket === 'hour' ? queryRaw(filters) : queryDaily(filters);
  const serializeRows = <T extends AggregateRow>(rows: T[]) => rows.map((row) => ({ ...row, ...serializeAggregate(row) }));

  const end = Date.now();
  const activityStart = localDay(end - 364 * DAY);
  const activityEnd = localDay(end);
  const activityWhere = dailyWhere(filters, activityStart, activityEnd);
  const activityRows = db.all<ActivityDay>(sql`
    SELECT d.day, COALESCE(SUM(d.requests), 0) AS requests,
      COALESCE(SUM(d.effective_tokens), 0) AS effective_tokens,
      COALESCE(SUM(d.cost), 0) AS cost
    FROM usage_daily d WHERE ${activityWhere} GROUP BY d.day ORDER BY d.day
  `);

  return {
    range: { from: filters.from, to: filters.to, bucket: filters.bucket },
    overview: serializeAggregate(result.overview),
    trend: fillTrend(result.trendRows, filters),
    by_token: serializeRows(result.byToken),
    by_provider: serializeRows(result.byProvider),
    by_model: serializeRows(result.byModel),
    activity: fillDailyActivity(activityRows, end, 365),
  };
}
