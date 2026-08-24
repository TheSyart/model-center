import type Database from 'better-sqlite3';

export interface BundledPricing {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  source: 'cc-switch-provider' | 'cc-switch-global';
}

export type PricingLookup = (baseUrl: string, protocol: string, modelId: string) => BundledPricing | null;

export function migrateModelPricingSchema(
  sqlite: Database.Database,
  lookup: PricingLookup,
  sourceRef: string,
  syncedAt = Date.now(),
): void {
  sqlite.transaction(() => {
    const columns = sqlite.prepare('PRAGMA table_info(models)').all() as Array<{ name: string }>;
    const existing = new Set(columns.map((column) => column.name));
    const additions: Array<[string, string]> = [
      ['cache_read_price', 'REAL'],
      ['cache_write_price', 'REAL'],
      ['pricing_source', 'TEXT'],
      ['pricing_source_ref', 'TEXT'],
      ['pricing_synced_at', 'INTEGER'],
    ];
    for (const [name, type] of additions) {
      if (!existing.has(name)) sqlite.exec(`ALTER TABLE models ADD COLUMN ${name} ${type}`);
    }

    sqlite.exec(`
      UPDATE models
      SET pricing_source = 'manual', pricing_source_ref = NULL, pricing_synced_at = NULL
      WHERE pricing_source IS NULL
        AND (input_price IS NOT NULL OR output_price IS NOT NULL
          OR cache_read_price IS NOT NULL OR cache_write_price IS NOT NULL)
    `);

    const rows = sqlite.prepare(`
      SELECT m.id, m.model_id, m.pricing_source, p.base_url, p.protocol
      FROM models m JOIN providers p ON p.id = m.provider_id
      WHERE COALESCE(m.pricing_source, '') <> 'manual'
    `).all() as Array<{ id: string; model_id: string; pricing_source: string | null; base_url: string; protocol: string }>;
    const update = sqlite.prepare(`
      UPDATE models SET
        input_price = ?, output_price = ?, cache_read_price = ?, cache_write_price = ?,
        pricing_source = ?, pricing_source_ref = ?, pricing_synced_at = ?
      WHERE id = ?
    `);
    for (const row of rows) {
      const pricing = lookup(row.base_url, row.protocol, row.model_id);
      if (!pricing) {
        update.run(null, null, null, null, null, null, null, row.id);
        continue;
      }
      update.run(
        pricing.input,
        pricing.output,
        pricing.cacheRead,
        pricing.cacheWrite,
        pricing.source,
        sourceRef,
        syncedAt,
        row.id,
      );
    }
  })();
}
