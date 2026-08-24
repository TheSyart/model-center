import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

// @ts-expect-error TS5097: runtime import intentionally includes the TypeScript extension.
import { migrateUsageSchema } from '../lib/db/usage-migration.ts';

function createLegacyDatabase() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE providers (id TEXT PRIMARY KEY, slug TEXT, name TEXT);
    CREATE TABLE gateway_tokens (id TEXT PRIMARY KEY, name TEXT, prefix TEXT);
    CREATE TABLE request_logs (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      provider_id TEXT,
      model_id TEXT,
      status INTEGER,
      latency_ms INTEGER,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      cost REAL,
      error TEXT,
      stream INTEGER,
      token_id TEXT
    );
  `);
  sqlite.prepare('INSERT INTO providers (id, slug, name) VALUES (?, ?, ?)').run('p1', 'deepseek', 'DeepSeek');
  sqlite.prepare('INSERT INTO gateway_tokens (id, name, prefix) VALUES (?, ?, ?)').run('t1', '开发令牌', 'mc-test');
  sqlite
    .prepare(
      `INSERT INTO request_logs
       (id, ts, provider_id, model_id, status, latency_ms, prompt_tokens, completion_tokens, total_tokens, cost, stream, token_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run('l1', new Date(2026, 7, 24, 10).getTime(), 'p1', 'deepseek-chat', 200, 320, 20, 10, 30, 0.001, 0, 't1');
  return sqlite;
}

test('usage migration is idempotent and backfills legacy logs without inventing cache metrics', () => {
  const sqlite = createLegacyDatabase();

  migrateUsageSchema(sqlite);
  migrateUsageSchema(sqlite);

  const columns = sqlite.prepare('PRAGMA table_info(request_logs)').all() as Array<{ name: string }>;
  for (const name of [
    'entry_protocol',
    'source',
    'token_name',
    'token_prefix',
    'uncached_input_tokens',
    'cache_read_tokens',
    'cache_write_tokens',
    'cache_metrics_observed',
    'first_token_ms',
    'duration_ms',
  ]) {
    assert.equal(columns.some((column) => column.name === name), true, `missing ${name}`);
  }

  const rows = sqlite.prepare('SELECT * FROM usage_daily').all() as Array<Record<string, unknown>>;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].requests, 1);
  assert.equal(rows[0].success, 1);
  assert.equal(rows[0].effective_tokens, 30);
  assert.equal(rows[0].cache_observed_requests, 0);
  assert.equal(rows[0].token_name, '开发令牌');
  assert.equal(rows[0].provider_slug, 'deepseek');

  const indexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>;
  for (const name of ['idx_logs_token_ts', 'idx_logs_provider_ts', 'idx_logs_model_ts', 'idx_logs_entry_ts']) {
    assert.equal(indexes.some((index) => index.name === name), true, `missing ${name}`);
  }

  sqlite.close();
});
