import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { migrateProviderEndpointSchema } from '../lib/db/provider-endpoint-migration.ts';

function legacyDatabase() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE providers (
      id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      protocol TEXT NOT NULL, base_url TEXT NOT NULL, api_key_enc TEXT NOT NULL,
      enabled INTEGER NOT NULL, priority INTEGER NOT NULL, remark TEXT
    );
    CREATE TABLE models (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, model_id TEXT NOT NULL);
    CREATE TABLE route_aliases (id TEXT PRIMARY KEY, alias TEXT NOT NULL, targets TEXT NOT NULL);
    CREATE TABLE request_logs (id TEXT PRIMARY KEY, provider_id TEXT, model_id TEXT);
  `);
  sqlite.prepare('INSERT INTO providers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    'legacy-provider', 'legacy', 'Legacy', 'openai', 'https://legacy.example/v1', 'ciphertext', 1, 7, 'keep me',
  );
  sqlite.prepare('INSERT INTO providers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    'already-endpoint', 'existing', 'Existing', 'anthropic', 'https://existing.example', 'ciphertext-2', 0, 3, 'also keep',
  );
  sqlite.exec(`
    CREATE TABLE provider_endpoints (
      id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      protocol TEXT NOT NULL, base_url TEXT NOT NULL, enabled INTEGER NOT NULL,
      is_default INTEGER NOT NULL, preset_variant_slug TEXT, source_ref TEXT,
      model_catalog_complete INTEGER NOT NULL DEFAULT 0, models_observed_at INTEGER,
      created_at INTEGER, updated_at INTEGER, UNIQUE(provider_id, protocol)
    );
  `);
  sqlite.prepare(`INSERT INTO provider_endpoints
    (id, provider_id, protocol, base_url, enabled, is_default, model_catalog_complete)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('existing-endpoint', 'already-endpoint', 'anthropic', 'https://configured.example', 0, 0, 0);
  sqlite.prepare('INSERT INTO models VALUES (?, ?, ?)').run('model-1', 'legacy-provider', 'model-a');
  sqlite.prepare('INSERT INTO route_aliases VALUES (?, ?, ?)').run('alias-1', 'alias-a', '[]');
  sqlite.prepare('INSERT INTO request_logs VALUES (?, ?, ?)').run('log-1', 'legacy-provider', 'model-a');
  return sqlite;
}

test('endpoint migration is idempotent, preserves legacy rows, and backfills only missing endpoint sets', () => {
  const sqlite = legacyDatabase();

  migrateProviderEndpointSchema(sqlite, 1234);
  migrateProviderEndpointSchema(sqlite, 5678);

  const provider = sqlite.prepare('SELECT * FROM providers WHERE id = ?').get('legacy-provider') as Record<string, unknown>;
  assert.equal(provider.slug, 'legacy');
  assert.equal(provider.api_key_enc, 'ciphertext');
  assert.equal(provider.priority, 7);
  assert.equal(provider.remark, 'keep me');
  assert.equal(provider.preset_key, null);

  assert.deepEqual(
    sqlite.prepare('SELECT provider_id, protocol, base_url, enabled, is_default, created_at FROM provider_endpoints ORDER BY provider_id').all(),
    [
      { provider_id: 'already-endpoint', protocol: 'anthropic', base_url: 'https://configured.example', enabled: 0, is_default: 0, created_at: null },
      { provider_id: 'legacy-provider', protocol: 'openai', base_url: 'https://legacy.example/v1', enabled: 1, is_default: 1, created_at: 1234 },
    ],
  );
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM models').get() as { n: number }).n, 1);
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM route_aliases').get() as { n: number }).n, 1);
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM request_logs').get() as { n: number }).n, 1);

  const endpointIndexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>;
  assert.equal(endpointIndexes.some((index) => index.name === 'idx_provider_endpoints_provider_default'), true);
  const endpointModelColumns = sqlite.prepare('PRAGMA table_info(provider_endpoint_models)').all() as Array<{ name: string; pk: number }>;
  assert.deepEqual(
    endpointModelColumns.filter((column) => column.pk > 0).map((column) => column.name),
    ['endpoint_id', 'model_id'],
  );
  sqlite.close();
});
