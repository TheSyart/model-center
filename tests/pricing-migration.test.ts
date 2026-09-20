import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { migrateModelPricingSchema } from '../lib/db/pricing-migration.ts';

function database() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE providers (id TEXT PRIMARY KEY, protocol TEXT, base_url TEXT);
    CREATE TABLE models (
      id TEXT PRIMARY KEY, provider_id TEXT, model_id TEXT,
      input_price REAL, output_price REAL
    );
    CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
  `);
  sqlite.prepare('INSERT INTO providers VALUES (?, ?, ?)').run('p1', 'openai', 'https://api.example.com/v1');
  sqlite.prepare('INSERT INTO models VALUES (?, ?, ?, ?, ?)').run('manual', 'p1', 'manual-model', 9, 10);
  sqlite.prepare('INSERT INTO models VALUES (?, ?, ?, ?, ?)').run('auto', 'p1', 'auto-model', null, null);
  return sqlite;
}

test('pricing migration preserves manual rows and applies bundled four-class pricing', () => {
  const sqlite = database();
  const lookup = (_baseUrl: string, _protocol: string, modelId: string) =>
    modelId === 'auto-model'
      ? { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.5, source: 'cc-switch-global' as const }
      : null;

  migrateModelPricingSchema(sqlite, lookup, 'commit-a', 1234);
  const rows = sqlite.prepare('SELECT * FROM models ORDER BY id').all() as Array<Record<string, unknown>>;
  assert.deepEqual(rows[0], {
    id: 'auto', provider_id: 'p1', model_id: 'auto-model', input_price: 1, output_price: 2,
    cache_read_price: 0.1, cache_write_price: 0.5, pricing_source: 'cc-switch-global',
    pricing_source_ref: 'commit-a', pricing_synced_at: 1234,
    pricing_tiers_json: null, pricing_currency: null,
  });
  assert.equal(rows[1]?.input_price, 9);
  assert.equal(rows[1]?.output_price, 10);
  assert.equal(rows[1]?.pricing_source, 'manual');

  migrateModelPricingSchema(sqlite, () => ({ input: 3, output: 4, cacheRead: 0.3, cacheWrite: 1, source: 'cc-switch-global' }), 'commit-b', 5678);
  const manual = sqlite.prepare("SELECT * FROM models WHERE id = 'manual'").get() as Record<string, unknown>;
  assert.equal(manual.input_price, 9);
  assert.equal(manual.pricing_source_ref, null);

  migrateModelPricingSchema(sqlite, () => null, 'commit-c', 9012);
  const removed = sqlite.prepare("SELECT * FROM models WHERE id = 'auto'").get() as Record<string, unknown>;
  assert.equal(removed.input_price, null);
  assert.equal(removed.cache_read_price, null);
  assert.equal(removed.pricing_source, null);
  sqlite.close();
});

test('boot-time re-resolution never clobbers vendor-official pricing', () => {
  const sqlite = database();
  migrateModelPricingSchema(sqlite, () => null, 'commit-a', 1234);
  // 模拟一次百炼官方目录同步的结果。
  sqlite
    .prepare(
      `UPDATE models SET pricing_source = 'aliyun-modelstudio', pricing_tiers_json = ?, pricing_currency = ?
       WHERE id = 'auto'`,
    )
    .run('[{"range_name":"Default"}]', 'CNY');

  // 再启动一次：cc-switch 查不到这个模型，原逻辑会把七个字段全部清空。
  migrateModelPricingSchema(sqlite, () => null, 'commit-b', 5678);

  const row = sqlite.prepare("SELECT * FROM models WHERE id = 'auto'").get() as Record<string, unknown>;
  assert.equal(row.pricing_source, 'aliyun-modelstudio');
  assert.equal(row.pricing_tiers_json, '[{"range_name":"Default"}]');
  assert.equal(row.pricing_currency, 'CNY');
});

test('boot-time re-resolution leaves every non-cc-switch source alone', () => {
  // 订阅账号写入的行（lib/subscriptions/store.ts）此前也会被开机重算清空。
  for (const source of ['subscription', 'aliyun-modelstudio', 'some-future-source']) {
    const sqlite = database();
    migrateModelPricingSchema(sqlite, () => null, 'commit-a', 1234);
    sqlite.prepare("UPDATE models SET pricing_source = ?, input_price = 7 WHERE id = 'auto'").run(source);

    migrateModelPricingSchema(
      sqlite,
      () => ({ input: 1, output: 2, cacheRead: null, cacheWrite: null, source: 'cc-switch-global' as const }),
      'commit-b',
      5678,
    );

    const row = sqlite.prepare("SELECT pricing_source, input_price FROM models WHERE id = 'auto'").get() as Record<string, unknown>;
    assert.equal(row.pricing_source, source, `${source} 不应被 cc-switch 覆盖`);
    assert.equal(row.input_price, 7, `${source} 的单价不应被 cc-switch 覆盖`);
    sqlite.close();
  }
});

test('repeated boots stop rewriting rows whose price has not changed', () => {
  const sqlite = database();
  const bundled = { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.5, source: 'cc-switch-global' as const };
  const lookup = (_baseUrl: string, _protocol: string, modelId: string) =>
    modelId === 'auto-model' ? bundled : null;

  let lookups = 0;
  const counting: typeof lookup = (baseUrl, protocol, modelId) => {
    lookups += 1;
    return lookup(baseUrl, protocol, modelId);
  };

  migrateModelPricingSchema(sqlite, counting, 'commit-a', 1000);
  const first = sqlite.prepare("SELECT * FROM models WHERE id = 'auto'").get() as Record<string, unknown>;
  assert.equal(first.pricing_synced_at, 1000);

  // 第二次启动：打包目录没变，不该产生任何写入。
  migrateModelPricingSchema(sqlite, counting, 'commit-a', 2000);
  const second = sqlite.prepare("SELECT * FROM models WHERE id = 'auto'").get() as Record<string, unknown>;
  assert.equal(
    second.pricing_synced_at,
    1000,
    'pricing_synced_at 被刷新了，说明这一行又被无谓地改写了一次',
  );
  assert.equal(lookups, 2, '两次启动各查一行');

  // 价格真的变了才写，并且这时候才更新同步时间。
  migrateModelPricingSchema(
    sqlite,
    () => ({ ...bundled, input: 7 }),
    'commit-b',
    3000,
  );
  const third = sqlite.prepare("SELECT * FROM models WHERE id = 'auto'").get() as Record<string, unknown>;
  assert.equal(third.input_price, 7);
  assert.equal(third.pricing_synced_at, 3000);
  assert.equal(third.pricing_source_ref, 'commit-b');
  sqlite.close();
});

test('a newly synced row with no pricing still gets priced on the next boot', () => {
  const sqlite = database();
  const lookup = () => ({ input: 1, output: 2, cacheRead: null, cacheWrite: null, source: 'cc-switch-global' as const });

  migrateModelPricingSchema(sqlite, lookup, 'commit-a', 1000);
  // 模拟同步流程之后新插进来的一行：还没有任何来源。
  sqlite
    .prepare('INSERT INTO models (id, provider_id, model_id, pricing_source) VALUES (?, ?, ?, ?)')
    .run('fresh', 'p1', 'fresh-model', null);

  migrateModelPricingSchema(sqlite, lookup, 'commit-a', 2000);
  const fresh = sqlite.prepare("SELECT * FROM models WHERE id = 'fresh'").get() as Record<string, unknown>;
  // 跳过无变化的行不能退化成"跳过整轮"，否则新行永远等不到定价。
  assert.equal(fresh.input_price, 1);
  assert.equal(fresh.pricing_synced_at, 2000);
  sqlite.close();
});
