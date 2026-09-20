import type Database from 'better-sqlite3';

/**
 * 开机重算只允许改写 **cc-switch 自己写下的** 行（以及尚无来源的空行）。
 *
 * 反过来写成「除了 manual 之外都重算」是危险的：任何新来源都要记得加进排除名单，
 * 忘一个就会在下次重启时被 cc-switch 的打包价格覆盖或直接清空。已经踩到两次——
 * 订阅账号写入的 pricing_source='subscription'（lib/subscriptions/store.ts），
 * 以及百炼官方价格 aliyun-modelstudio；cc-switch 目录里确实带着
 * dashscope.aliyuncs.com/compatible-mode/v1 的 qwen3-max 等定价，会真的盖上去。
 */
export const CC_SWITCH_OWNED_PRICING_SOURCES = ['', 'cc-switch-provider', 'cc-switch-global'] as const;

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
      // 厂商官方价格：阶梯与非 Token 计费项原样保留，扁平列只放可计算的基准档。
      ['pricing_tiers_json', 'TEXT'],
      ['pricing_currency', 'TEXT'],
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
      WHERE COALESCE(m.pricing_source, '') IN ('', 'cc-switch-provider', 'cc-switch-global')
    `).all() as Array<{ id: string; model_id: string; pricing_source: string | null; base_url: string; protocol: string }>;
    const update = sqlite.prepare(`
      UPDATE models SET
        input_price = ?, output_price = ?, cache_read_price = ?, cache_write_price = ?,
        pricing_source = ?, pricing_source_ref = ?, pricing_synced_at = ?,
        pricing_tiers_json = ?, pricing_currency = ?
      WHERE id = ?
    `);
    for (const row of rows) {
      const pricing = lookup(row.base_url, row.protocol, row.model_id);
      if (!pricing) {
        update.run(null, null, null, null, null, null, null, null, null, row.id);
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
        null,
        null,
        row.id,
      );
    }
  })();
}
