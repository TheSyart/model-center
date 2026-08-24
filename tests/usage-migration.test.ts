import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

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

test('usage migration clears historical logs once and keeps later logs on repeated startup', () => {
  const sqlite = createLegacyDatabase();

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
    'client_key',
    'client_name',
    'provider_endpoint_id',
    'upstream_protocol',
  ]) {
    assert.equal(columns.some((column) => column.name === name), true, `missing ${name}`);
  }

  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM request_logs').get() as { n: number }).n, 0);
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM usage_daily').get() as { n: number }).n, 0);

  sqlite.prepare('INSERT INTO request_logs (id, ts) VALUES (?, ?)').run('new-log', Date.now());
  migrateUsageSchema(sqlite);
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM request_logs').get() as { n: number }).n, 1);

  const marker = sqlite
    .prepare("SELECT 1 AS ok FROM schema_migrations WHERE name = 'cc_switch_usage_history_reset_v1'")
    .get() as { ok: number } | undefined;
  assert.equal(marker?.ok, 1);

  const indexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>;
  for (const name of ['idx_logs_token_ts', 'idx_logs_provider_ts', 'idx_logs_model_ts', 'idx_logs_entry_ts']) {
    assert.equal(indexes.some((index) => index.name === name), true, `missing ${name}`);
  }

  sqlite.close();
});
