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

/** 重算会写到的 8 个列（pricing_synced_at 不在内——它是写入时间，不参与比对）。 */
interface TargetPricing {
  input_price: number | null;
  output_price: number | null;
  cache_read_price: number | null;
  cache_write_price: number | null;
  pricing_source: string | null;
  pricing_source_ref: string | null;
  pricing_tiers_json: string | null;
  pricing_currency: string | null;
}

interface CurrentPricingRow extends TargetPricing {
  id: string;
  model_id: string;
  base_url: string;
  protocol: string;
}

function unchanged(current: TargetPricing, next: TargetPricing): boolean {
  return (Object.keys(next) as Array<keyof TargetPricing>).every((key) => current[key] === next[key]);
}

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

    // 白名单只有一份：此前这里写的是字面量，常量却导出给 model-sync 用，改一处会漏另一处。
    const ownedPlaceholders = CC_SWITCH_OWNED_PRICING_SOURCES.map(() => '?').join(', ');
    const rows = sqlite
      .prepare(
        `SELECT m.id, m.model_id, m.base_url, m.protocol,
                m.input_price, m.output_price, m.cache_read_price, m.cache_write_price,
                m.pricing_source, m.pricing_source_ref, m.pricing_tiers_json, m.pricing_currency
         FROM (
           SELECT m.*, p.base_url, p.protocol
           FROM models m JOIN providers p ON p.id = m.provider_id
           WHERE COALESCE(m.pricing_source, '') IN (${ownedPlaceholders})
         ) m`,
      )
      .all(...CC_SWITCH_OWNED_PRICING_SOURCES) as Array<CurrentPricingRow>;

    const update = sqlite.prepare(`
      UPDATE models SET
        input_price = ?, output_price = ?, cache_read_price = ?, cache_write_price = ?,
        pricing_source = ?, pricing_source_ref = ?, pricing_synced_at = ?,
        pricing_tiers_json = ?, pricing_currency = ?
      WHERE id = ?
    `);

    for (const row of rows) {
      const pricing = lookup(row.base_url, row.protocol, row.model_id);
      const next: TargetPricing = pricing
        ? {
            input_price: pricing.input,
            output_price: pricing.output,
            cache_read_price: pricing.cacheRead,
            cache_write_price: pricing.cacheWrite,
            pricing_source: pricing.source,
            pricing_source_ref: sourceRef,
            pricing_tiers_json: null,
            pricing_currency: null,
          }
        : // 打包目录里查不到就清空——这行的价格本来就是 cc-switch 写的。
          {
            input_price: null,
            output_price: null,
            cache_read_price: null,
            cache_write_price: null,
            pricing_source: null,
            pricing_source_ref: null,
            pricing_tiers_json: null,
            pricing_currency: null,
          };

      // 算出来和库里一模一样就不写。开机重算此前无条件改写每一行，
      // 连 pricing_synced_at 都会被刷成新的 Date.now()，于是"最近同步时间"
      // 其实是"最近重启时间"；而一个每次启动都在改数据的迁移，正是上一轮
      // subscription 价格被静默清空的温床。
      if (unchanged(row, next)) continue;

      update.run(
        next.input_price,
        next.output_price,
        next.cache_read_price,
        next.cache_write_price,
        next.pricing_source,
        next.pricing_source_ref,
        syncedAt,
        next.pricing_tiers_json,
        next.pricing_currency,
        row.id,
      );
    }
  })();
}
