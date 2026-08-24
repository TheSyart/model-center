import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getSetting } from '@/lib/settings';

// ---------- 日志查询（F8） ----------

export interface LogFilters {
  provider?: string; // provider_id
  model?: string;
  token?: string;
  entry?: string;
  client?: string;
  status?: string; // '2xx' | 'error'
  stream?: string; // '1' | '0'
  from?: number; // ms 时间戳
  to?: number;
  q?: string; // error 摘要模糊
  page: number;
  pageSize: number;
}

export interface LogRow {
  id: string;
  ts: number;
  provider_id: string | null;
  provider_name: string | null;
  provider_slug: string | null;
  model_id: string | null;
  alias: string | null;
  prompt_id: string | null;
  status: number | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost: number | null;
  error: string | null;
  stream: number | null;
  token_id: string | null;
  token_name: string | null;
  token_prefix: string | null;
  client_key: string | null;
  client_name: string | null;
  entry_protocol: string | null;
  source: string | null;
  uncached_input_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  cache_metrics_observed: number | null;
  first_token_ms: number | null;
  duration_ms: number | null;
}

function buildWhere(f: LogFilters) {
  return sql`
    (${f.provider ? sql`l.provider_id = ${f.provider}` : sql`1=1`})
    AND (${f.model ? sql`l.model_id = ${f.model}` : sql`1=1`})
    AND (${f.token ? sql`l.token_id = ${f.token}` : sql`1=1`})
    AND (${f.entry ? sql`l.entry_protocol = ${f.entry}` : sql`1=1`})
    AND (${f.client ? sql`l.client_key = ${f.client}` : sql`1=1`})
    AND (${f.status === '2xx' ? sql`l.status BETWEEN 200 AND 299` : f.status === 'error' ? sql`NOT (l.status BETWEEN 200 AND 299)` : sql`1=1`})
    AND (${f.stream === '1' ? sql`l.stream = 1` : f.stream === '0' ? sql`l.stream = 0` : sql`1=1`})
    AND (${f.from ? sql`l.ts >= ${f.from}` : sql`1=1`})
    AND (${f.to ? sql`l.ts <= ${f.to}` : sql`1=1`})
    AND (${f.q ? sql`l.error LIKE ${'%' + f.q + '%'}` : sql`1=1`})
  `;
}

export function queryLogs(f: LogFilters): { logs: LogRow[]; total: number } {
  const where = buildWhere(f);
  const totalRow = db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM request_logs l WHERE ${where}`);
  const logs = db.all<LogRow>(sql`
    SELECT l.id, l.ts, l.provider_id, p.name AS provider_name, p.slug AS provider_slug,
      l.model_id, l.alias, l.prompt_id, l.status, l.latency_ms,
      l.prompt_tokens, l.completion_tokens, l.total_tokens, l.cost, l.error, l.stream,
      l.token_id, COALESCE(l.token_name, t.name) AS token_name,
      COALESCE(l.token_prefix, t.prefix) AS token_prefix,
      l.client_key, l.client_name, l.entry_protocol, l.source,
      l.uncached_input_tokens, l.cache_read_tokens,
      l.cache_write_tokens, l.cache_metrics_observed, l.first_token_ms, l.duration_ms
    FROM request_logs l
    LEFT JOIN providers p ON p.id = l.provider_id
    LEFT JOIN gateway_tokens t ON t.id = l.token_id
    WHERE ${where}
    ORDER BY l.ts DESC
    LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
  `);
  return { logs, total: totalRow?.n ?? 0 };
}

// ---------- 用量统计（F9） ----------

interface AggRow {
  requests: number;
  success: number;
  tokens: number;
  cost: number;
}

function aggSince(since: number): AggRow {
  return (
    db.get<AggRow>(sql`
      SELECT COUNT(*) AS requests,
        SUM(CASE WHEN status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS success,
        COALESCE(SUM(total_tokens), 0) AS tokens,
        COALESCE(SUM(cost), 0) AS cost
      FROM request_logs WHERE ts >= ${since}
    `) ?? { requests: 0, success: 0, tokens: 0, cost: 0 }
  );
}

function withRate(r: AggRow) {
  return { ...r, success_rate: r.requests > 0 ? r.success / r.requests : null };
}

export function getStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 86_400_000;

  const overview = {
    today: withRate(aggSince(todayStart)),
    last_7d: withRate(aggSince(todayStart - 6 * DAY)),
    last_30d: withRate(aggSince(todayStart - 29 * DAY)),
  };

  const since30 = todayStart - 29 * DAY;
  const byProvider = db.all(sql`
    SELECT l.provider_id, p.name AS provider_name, p.slug AS provider_slug,
      COUNT(*) AS requests,
      SUM(CASE WHEN l.status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS success,
      COALESCE(SUM(l.total_tokens), 0) AS tokens,
      COALESCE(SUM(l.cost), 0) AS cost
    FROM request_logs l LEFT JOIN providers p ON p.id = l.provider_id
    WHERE l.ts >= ${since30}
    GROUP BY l.provider_id ORDER BY requests DESC
  `);
  const byModel = db.all(sql`
    SELECT l.provider_id, p.slug AS provider_slug, l.model_id,
      COUNT(*) AS requests,
      SUM(CASE WHEN l.status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS success,
      COALESCE(SUM(l.total_tokens), 0) AS tokens,
      COALESCE(SUM(l.cost), 0) AS cost
    FROM request_logs l LEFT JOIN providers p ON p.id = l.provider_id
    WHERE l.ts >= ${since30}
    GROUP BY l.provider_id, l.model_id ORDER BY tokens DESC
  `);

  // 近 14 天按天聚合（本地时区），缺失天补零
  const since14 = todayStart - 13 * DAY;
  const rows = db.all<{ day: string; requests: number; tokens: number; cost: number }>(sql`
    SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch', 'localtime') AS day,
      COUNT(*) AS requests, COALESCE(SUM(total_tokens), 0) AS tokens, COALESCE(SUM(cost), 0) AS cost
    FROM request_logs WHERE ts >= ${since14}
    GROUP BY day
  `);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const trend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(todayStart - (13 - i) * DAY);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const r = byDay.get(key);
    return { day: key, requests: r?.requests ?? 0, tokens: r?.tokens ?? 0, cost: r?.cost ?? 0 };
  });

  return { overview, by_provider: byProvider, by_model: byModel, trend };
}

// ---------- 日志保留策略 ----------

export function getLogRetentionDays(): number {
  const v = Number(getSetting('log_retention_days'));
  return Number.isFinite(v) && v > 0 ? v : 30;
}

/** 清理过期日志，返回删除条数。 */
export function purgeExpiredLogs(now = Date.now()): number {
  const cutoff = now - getLogRetentionDays() * 86_400_000;
  const result = db.run(sql`DELETE FROM request_logs WHERE ts < ${cutoff}`);
  return result.changes;
}

/** 日聚合保留 400 天，覆盖年度热力图并留出少量运维余量。 */
export function purgeExpiredUsageDaily(now = Date.now()): number {
  const date = new Date(now - 400 * 86_400_000);
  const cutoff = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return db.run(sql`DELETE FROM usage_daily WHERE day < ${cutoff}`).changes;
}

let nextRetentionSweepAt = 0;
const RETENTION_SWEEP_INTERVAL_MS = 6 * 3_600_000;

/** 进程首次写入必定清理，之后最多每 6 小时一次，避免概率策略长期漏清。 */
export function maybePurgeExpiredLogs(now = Date.now()): void {
  if (now < nextRetentionSweepAt) return;
  nextRetentionSweepAt = now + RETENTION_SWEEP_INTERVAL_MS;
  try {
    purgeExpiredLogs(now);
    purgeExpiredUsageDaily(now);
  } catch (e) {
    // 一分钟后允许重试，避免一次锁冲突阻断整个进程生命周期的保留策略。
    nextRetentionSweepAt = now + 60_000;
    console.error('[logs] 定时清理过期日志失败:', e);
  }
}
