import type Database from 'better-sqlite3';

/**
 * 将旧 providers.protocol/base_url 投影扩展为规范化端点集合。
 * 迁移不使用 marker：所有 DDL 均幂等，回填只针对完全没有端点的服务商。
 */
export function migrateProviderEndpointSchema(sqlite: Database.Database, now = Date.now()): void {
  sqlite.transaction(() => {
    const providerColumns = sqlite.prepare('PRAGMA table_info(providers)').all() as Array<{ name: string }>;
    if (!providerColumns.some((column) => column.name === 'preset_key')) {
      sqlite.exec('ALTER TABLE providers ADD COLUMN preset_key TEXT');
    }

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS provider_endpoints (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        protocol TEXT NOT NULL,
        base_url TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        is_default INTEGER NOT NULL DEFAULT 0,
        preset_variant_slug TEXT,
        source_ref TEXT,
        model_catalog_complete INTEGER NOT NULL DEFAULT 0,
        models_observed_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(provider_id, protocol)
      );
      CREATE INDEX IF NOT EXISTS idx_provider_endpoints_provider_default
        ON provider_endpoints(provider_id, is_default);
      CREATE TABLE IF NOT EXISTS provider_endpoint_models (
        endpoint_id TEXT NOT NULL REFERENCES provider_endpoints(id) ON DELETE CASCADE,
        model_id TEXT NOT NULL,
        source TEXT NOT NULL,
        observed_at INTEGER,
        PRIMARY KEY(endpoint_id, model_id)
      );
    `);

    sqlite.prepare(`
      INSERT INTO provider_endpoints (
        id, provider_id, protocol, base_url, enabled, is_default,
        model_catalog_complete, created_at, updated_at
      )
      SELECT
        lower(hex(randomblob(16))), p.id, p.protocol, p.base_url, 1, 1, 0, ?, ?
      FROM providers p
      WHERE NOT EXISTS (
        SELECT 1 FROM provider_endpoints e WHERE e.provider_id = p.id
      )
    `).run(now, now);
  })();
}
