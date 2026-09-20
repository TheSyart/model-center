import type Database from 'better-sqlite3';
import { hasAppliedMigration, markMigrationApplied, runOnce } from './migration-marker.ts';

const REQUEST_LOG_COLUMNS: Array<[string, string]> = [
  ['entry_protocol', 'TEXT'],
  ['source', 'TEXT'],
  ['token_name', 'TEXT'],
  ['token_prefix', 'TEXT'],
  ['uncached_input_tokens', 'INTEGER'],
  ['cache_read_tokens', 'INTEGER'],
  ['cache_write_tokens', 'INTEGER'],
  ['cache_metrics_observed', 'INTEGER'],
  ['first_token_ms', 'INTEGER'],
  ['duration_ms', 'INTEGER'],
  ['client_key', 'TEXT'],
  ['client_name', 'TEXT'],
  ['provider_endpoint_id', 'TEXT'],
  ['upstream_protocol', 'TEXT'],
];

/**
 * 增加细粒度用量字段并把已有原始日志回填到日聚合表。
 * 使用独立迁移标记保证重复启动不会重复累加历史数据。
 */
export function migrateUsageSchema(sqlite: Database.Database): void {
  const transaction = sqlite.transaction(() => {
    const columns = sqlite.prepare('PRAGMA table_info(request_logs)').all() as Array<{ name: string }>;
    const existing = new Set(columns.map((column) => column.name));
    for (const [name, type] of REQUEST_LOG_COLUMNS) {
      if (!existing.has(name)) sqlite.exec(`ALTER TABLE request_logs ADD COLUMN ${name} ${type}`);
    }

    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_token_ts ON request_logs(token_id, ts);
      CREATE INDEX IF NOT EXISTS idx_logs_provider_ts ON request_logs(provider_id, ts);
      CREATE INDEX IF NOT EXISTS idx_logs_model_ts ON request_logs(model_id, ts);
      CREATE INDEX IF NOT EXISTS idx_logs_entry_ts ON request_logs(entry_protocol, ts);
      CREATE INDEX IF NOT EXISTS idx_logs_client_ts ON request_logs(client_key, ts);
      CREATE INDEX IF NOT EXISTS idx_logs_endpoint_ts ON request_logs(provider_endpoint_id, ts);

      CREATE TABLE IF NOT EXISTS usage_daily (
        id TEXT PRIMARY KEY,
        day TEXT NOT NULL,
        token_id TEXT NOT NULL DEFAULT '',
        token_name TEXT,
        token_prefix TEXT,
        provider_id TEXT NOT NULL DEFAULT '',
        provider_name TEXT,
        provider_slug TEXT,
        model_id TEXT NOT NULL DEFAULT '',
        entry_protocol TEXT NOT NULL DEFAULT '',
        requests INTEGER NOT NULL DEFAULT 0,
        success INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        uncached_input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_tokens INTEGER NOT NULL DEFAULT 0,
        effective_tokens INTEGER NOT NULL DEFAULT 0,
        cost REAL NOT NULL DEFAULT 0,
        priced_requests INTEGER NOT NULL DEFAULT 0,
        duration_total_ms INTEGER NOT NULL DEFAULT 0,
        duration_count INTEGER NOT NULL DEFAULT 0,
        first_token_total_ms INTEGER NOT NULL DEFAULT 0,
        first_token_count INTEGER NOT NULL DEFAULT 0,
        cache_observed_requests INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_daily_dimensions
        ON usage_daily(day, token_id, provider_id, model_id, entry_protocol);
      CREATE INDEX IF NOT EXISTS idx_usage_daily_day ON usage_daily(day);
      CREATE INDEX IF NOT EXISTS idx_usage_daily_token_day ON usage_daily(token_id, day);
      CREATE INDEX IF NOT EXISTS idx_usage_daily_provider_day ON usage_daily(provider_id, day);
      CREATE INDEX IF NOT EXISTS idx_usage_daily_model_day ON usage_daily(model_id, day);

      -- 旧库里这张表由本迁移创建；新库在 CREATE_TABLES_SQL 里就有了，这里保留以兼容升级路径。
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);

    const usageColumns = sqlite.prepare('PRAGMA table_info(usage_daily)').all() as Array<{ name: string }>;
    if (!usageColumns.some((column) => column.name === 'input_tokens')) {
      sqlite.exec('ALTER TABLE usage_daily ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0');
    }

    if (!hasAppliedMigration(sqlite, 'usage_rollup_v1')) {
      sqlite.exec(`
        INSERT INTO usage_daily (
          id, day, token_id, token_name, token_prefix,
          provider_id, provider_name, provider_slug, model_id, entry_protocol,
          requests, success, input_tokens, uncached_input_tokens, output_tokens,
          cache_read_tokens, cache_write_tokens, effective_tokens,
          cost, priced_requests, duration_total_ms, duration_count,
          first_token_total_ms, first_token_count, cache_observed_requests
        )
        SELECT
          lower(hex(randomblob(16))),
          strftime('%Y-%m-%d', l.ts / 1000, 'unixepoch', 'localtime'),
          COALESCE(l.token_id, ''),
          COALESCE(MAX(l.token_name), MAX(t.name)),
          COALESCE(MAX(l.token_prefix), MAX(t.prefix)),
          COALESCE(l.provider_id, ''),
          MAX(p.name),
          MAX(p.slug),
          COALESCE(l.model_id, ''),
          COALESCE(l.entry_protocol, ''),
          COUNT(*),
          SUM(CASE WHEN l.status BETWEEN 200 AND 299 THEN 1 ELSE 0 END),
          COALESCE(SUM(CASE WHEN l.cache_metrics_observed = 1 THEN l.uncached_input_tokens ELSE l.prompt_tokens END), 0),
          COALESCE(SUM(CASE WHEN l.cache_metrics_observed = 1 THEN l.uncached_input_tokens ELSE 0 END), 0),
          COALESCE(SUM(l.completion_tokens), 0),
          COALESCE(SUM(l.cache_read_tokens), 0),
          COALESCE(SUM(l.cache_write_tokens), 0),
          COALESCE(SUM(
            CASE WHEN l.cache_metrics_observed = 1
              THEN COALESCE(l.uncached_input_tokens, 0) + COALESCE(l.completion_tokens, 0)
                + COALESCE(l.cache_read_tokens, 0) + COALESCE(l.cache_write_tokens, 0)
              ELSE COALESCE(l.total_tokens, 0)
            END
          ), 0),
          COALESCE(SUM(l.cost), 0),
          SUM(CASE WHEN l.cost IS NOT NULL THEN 1 ELSE 0 END),
          COALESCE(SUM(COALESCE(l.duration_ms, l.latency_ms)), 0),
          SUM(CASE WHEN l.duration_ms IS NOT NULL OR l.latency_ms IS NOT NULL THEN 1 ELSE 0 END),
          COALESCE(SUM(l.first_token_ms), 0),
          SUM(CASE WHEN l.first_token_ms IS NOT NULL THEN 1 ELSE 0 END),
          SUM(CASE WHEN l.cache_metrics_observed = 1 THEN 1 ELSE 0 END)
        FROM request_logs l
        LEFT JOIN gateway_tokens t ON t.id = l.token_id
        LEFT JOIN providers p ON p.id = l.provider_id
        GROUP BY
          strftime('%Y-%m-%d', l.ts / 1000, 'unixepoch', 'localtime'),
          COALESCE(l.token_id, ''), COALESCE(l.provider_id, ''),
          COALESCE(l.model_id, ''), COALESCE(l.entry_protocol, '');
      `);
      markMigrationApplied(sqlite, 'usage_rollup_v1');
    }

    // CC Switch 四档计价上线后，按产品决策只清空请求/用量历史一次；配置与余额快照不受影响。
    runOnce(sqlite, 'cc_switch_usage_history_reset_v1', () => {
      sqlite.exec('DELETE FROM request_logs; DELETE FROM usage_daily;');
    });
  });
  transaction();
}
