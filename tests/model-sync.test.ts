import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { migrateProviderEndpointSchema } from '../lib/db/provider-endpoint-migration.ts';
import { fetchAllUpstreamModels, syncProviderModels, type SyncModelsDependencies } from '../lib/services/model-sync.ts';

function database() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE providers (
      id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      protocol TEXT NOT NULL, base_url TEXT NOT NULL, api_key_enc TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 0,
      balance_config TEXT, remark TEXT, created_at INTEGER, updated_at INTEGER
    );
    CREATE TABLE models (
      id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, model_id TEXT NOT NULL,
      alias TEXT, display_name TEXT, enabled INTEGER NOT NULL DEFAULT 1,
      input_price REAL, output_price REAL, cache_read_price REAL, cache_write_price REAL,
      pricing_source TEXT, pricing_source_ref TEXT, pricing_synced_at INTEGER,
      pricing_tiers_json TEXT, pricing_currency TEXT,
      context_window INTEGER, synced INTEGER NOT NULL DEFAULT 0,
      capabilities_json TEXT, reasoning_json TEXT,
      UNIQUE(provider_id, model_id)
    );
    CREATE TABLE route_aliases (
      id TEXT PRIMARY KEY, alias TEXT, targets TEXT, enabled INTEGER NOT NULL DEFAULT 1
    );
  `);
  sqlite.prepare(`INSERT INTO providers
    (id, slug, name, protocol, base_url, api_key_enc, enabled, priority)
    VALUES ('provider-1', 'example', 'Example', 'openai', 'https://legacy.example/v1', 'cipher', 1, 0)`).run();
  migrateProviderEndpointSchema(sqlite, 100);
  const legacyId = (sqlite.prepare('SELECT id FROM provider_endpoints WHERE provider_id = ?').get('provider-1') as { id: string }).id;
  sqlite.prepare(`UPDATE provider_endpoints SET base_url = 'https://chat.example/v1', is_default = 1,
    model_catalog_complete = 1, models_observed_at = 101 WHERE id = ?`).run(legacyId);
  sqlite.prepare(`UPDATE providers SET base_url = 'https://chat.example/v1' WHERE id = 'provider-1'`).run();
  sqlite.prepare(`INSERT INTO provider_endpoint_models (endpoint_id, model_id, source, observed_at)
    VALUES (?, 'old-model', 'sync', 101)`).run(legacyId);
  sqlite.prepare(`INSERT INTO provider_endpoints
    (id, provider_id, protocol, base_url, enabled, is_default, model_catalog_complete, created_at, updated_at)
    VALUES ('responses-id', 'provider-1', 'openai-responses', 'https://responses.example/v1', 1, 0, 0, 100, 100)`).run();
  return { sqlite, legacyId };
}

const provider = {
  id: 'provider-1', slug: 'example', name: 'Example', protocol: 'openai', baseUrl: 'https://legacy.example/v1',
  presetKey: null, workspaceId: null, apiKeyEnc: 'cipher', enabled: 1, priority: 0, balanceConfig: null, remark: null,
  createdAt: null, updatedAt: null,
};

const bailianProvider = {
  ...provider,
  slug: 'bailian',
  presetKey: 'bailian',
  workspaceId: 'llm-a5kyboh5x4q9inqe',
};

function dependencies(sqlite: Database.Database, fetchImpl: typeof fetch): SyncModelsDependencies {
  let id = 0;
  return {
    sqlite,
    fetch: fetchImpl,
    lookupPricing: () => null,
    randomId: () => `model-row-${++id}`,
    pricingSourceRef: 'test-ref',
    now: () => 500,
  };
}

test('OpenAI-compatible synchronization follows has_more/last_id pages and writes the same endpoint catalog', async () => {
  const { sqlite, legacyId } = database();
  const urls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    urls.push(url);
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer upstream-key');
    if (urls.length === 1) return Response.json({ data: [{ id: 'model-a' }], has_more: true, last_id: 'cursor-a' });
    return Response.json({ data: [{ id: 'model-b' }], has_more: false });
  }) as typeof fetch;

  const result = await syncProviderModels(provider as any, 'upstream-key', dependencies(sqlite, fetchImpl));

  assert.equal(result.total_upstream, 2);
  assert.deepEqual(urls, [
    'https://chat.example/v1/models',
    'https://chat.example/v1/models?after_id=cursor-a',
  ]);
  assert.deepEqual(
    sqlite.prepare('SELECT model_id, source FROM provider_endpoint_models WHERE endpoint_id = ? ORDER BY model_id').all(legacyId),
    [{ model_id: 'model-a', source: 'sync' }, { model_id: 'model-b', source: 'sync' }],
  );
  assert.equal((sqlite.prepare('SELECT model_catalog_complete FROM provider_endpoints WHERE id = ?').get(legacyId) as { model_catalog_complete: number }).model_catalog_complete, 1);
  sqlite.close();
});

test('Gemini synchronization follows nextPageToken using pageToken', async () => {
  const urls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return urls.length === 1
      ? Response.json({ models: [{ name: 'models/gemini-a' }], nextPageToken: 'next token' })
      : Response.json({ models: [{ name: 'models/gemini-b' }] });
  }) as typeof fetch;

  const ids = await fetchAllUpstreamModels(
    { ...provider, protocol: 'gemini', baseUrl: 'https://gemini.example' } as any,
    'upstream-key',
    fetchImpl,
  );
  assert.deepEqual(ids, ['gemini-a', 'gemini-b']);
  assert.deepEqual(urls, [
    'https://gemini.example/v1beta/models',
    'https://gemini.example/v1beta/models?pageToken=next+token',
  ]);
});

test('Bailian synchronization uses the official workspace catalog and follows output.total pages', async () => {
  const urls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    urls.push(String(input));
    assert.deepEqual(init?.headers, {
      Authorization: 'Bearer upstream-key',
      'Content-Type': 'application/json',
    });
    return urls.length === 1
      ? Response.json({
          success: true,
          output: { total: 2, page_no: 1, page_size: 20, models: [{ model: 'qwen3-max' }] },
          request_id: 'request-page-1',
        })
      : Response.json({
          success: true,
          output: { total: 2, page_no: 2, page_size: 20, models: [{ model: 'qwen-image-max' }] },
          request_id: 'request-page-2',
        });
  }) as typeof fetch;

  const ids = await fetchAllUpstreamModels(bailianProvider as any, 'upstream-key', fetchImpl);

  assert.deepEqual(ids, ['qwen3-max', 'qwen-image-max']);
  assert.deepEqual(urls, [
    'https://llm-a5kyboh5x4q9inqe.cn-beijing.maas.aliyuncs.com/api/v1/models?page_no=1&page_size=20',
    'https://llm-a5kyboh5x4q9inqe.cn-beijing.maas.aliyuncs.com/api/v1/models?page_no=2&page_size=20',
  ]);
});

test('Bailian synchronization rejects missing or unsafe workspace IDs before the request', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return Response.json({});
  }) as typeof fetch;

  await assert.rejects(
    fetchAllUpstreamModels({ ...bailianProvider, workspaceId: null } as any, 'key', fetchImpl),
    /Workspace ID/,
  );
  await assert.rejects(
    fetchAllUpstreamModels({ ...bailianProvider, workspaceId: 'unsafe.example.com' } as any, 'key', fetchImpl),
    /Workspace ID/,
  );
  assert.equal(calls, 0);
});

test('Bailian HTTP 200 business failures include the upstream code and request ID', async () => {
  await assert.rejects(
    fetchAllUpstreamModels(
      bailianProvider as any,
      'key',
      (async () => Response.json({
        success: false,
        code: 'InvalidParameter',
        message: 'workspace unavailable',
        request_id: 'request-failed',
      })) as typeof fetch,
    ),
    /InvalidParameter.*workspace unavailable.*request-failed/,
  );
});

test('Bailian synchronization retries a throttled catalog page before failing the sync', async () => {
  let calls = 0;
  const ids = await fetchAllUpstreamModels(
    bailianProvider as any,
    'key',
    (async () => {
      calls++;
      if (calls === 1) {
        return new Response(JSON.stringify({ code: 'Throttling.RateQuota' }), {
          status: 429,
          headers: { 'Retry-After': '0', 'Content-Type': 'application/json' },
        });
      }
      return Response.json({
        success: true,
        output: { total: 1, page_no: 1, page_size: 20, models: [{ model: 'qwen3-max' }] },
        request_id: 'request-after-retry',
      });
    }) as typeof fetch,
  );

  assert.equal(calls, 2);
  assert.deepEqual(ids, ['qwen3-max']);
});

test('Bailian models do not inherit bundled prices and do not mark the OpenAI endpoint catalog complete', async () => {
  const { sqlite, legacyId } = database();
  sqlite.prepare("UPDATE providers SET slug = 'bailian' WHERE id = 'provider-1'").run();
  let pricingLookups = 0;
  const deps = dependencies(sqlite, (async () => Response.json({
    success: true,
    output: {
      total: 1,
      page_no: 1,
      page_size: 20,
      models: [{ model: 'qwen3-max', name: '通义千问3-Max', model_info: { context_window: 131072 } }],
    },
    request_id: 'request-ok',
  })) as typeof fetch);
  deps.lookupPricing = () => {
    pricingLookups++;
    return { input: 99, output: 99, cacheRead: null, cacheWrite: null, source: 'forbidden-fallback' };
  };

  await syncProviderModels(bailianProvider as any, 'key', deps);

  assert.equal(pricingLookups, 0);
  assert.deepEqual(
    sqlite.prepare('SELECT model_id, display_name, context_window, input_price, output_price, pricing_source FROM models').all(),
    [{
      model_id: 'qwen3-max', display_name: '通义千问3-Max', context_window: 131072,
      input_price: null, output_price: null, pricing_source: null,
    }],
  );
  assert.deepEqual(
    sqlite.prepare('SELECT model_catalog_complete, models_observed_at FROM provider_endpoints WHERE id = ?').get(legacyId),
    { model_catalog_complete: 0, models_observed_at: 500 },
  );
  sqlite.close();
});

test('Bailian synchronization fills missing official metadata without overwriting existing model settings', async () => {
  const { sqlite } = database();
  sqlite.prepare(`INSERT INTO models (
    id, provider_id, model_id, alias, display_name, enabled,
    input_price, output_price, pricing_source, context_window, synced
  ) VALUES ('existing-row', 'provider-1', 'qwen3-max', 'stable-alias', NULL, 0, 1.25, 2.5, 'manual', NULL, 0)`).run();
  const fetchImpl = (async () => Response.json({
    success: true,
    output: {
      total: 1,
      page_no: 1,
      page_size: 20,
      models: [{ model: 'qwen3-max', name: '通义千问3-Max', model_info: { context_window: 131072 } }],
    },
    request_id: 'request-metadata',
  })) as typeof fetch;

  const result = await syncProviderModels(bailianProvider as any, 'key', dependencies(sqlite, fetchImpl));

  assert.equal(result.added, 0);
  assert.deepEqual(
    sqlite.prepare(`SELECT alias, display_name, enabled, input_price, output_price, pricing_source, context_window, synced
      FROM models WHERE id = 'existing-row'`).get(),
    {
      alias: 'stable-alias', display_name: '通义千问3-Max', enabled: 0,
      input_price: 1.25, output_price: 2.5, pricing_source: 'manual', context_window: 131072, synced: 0,
    },
  );
  sqlite.close();
});

for (const invalidName of ['models/', '  models/   ']) {
  test(`Gemini synchronization rejects an empty normalized model name (${JSON.stringify(invalidName)}) without database writes`, async () => {
    const { sqlite, legacyId } = database();
    sqlite.prepare(`
      UPDATE provider_endpoints SET protocol = 'gemini', base_url = 'https://gemini.example' WHERE id = ?
    `).run(legacyId);
    sqlite.prepare(`
      UPDATE providers SET protocol = 'gemini', base_url = 'https://gemini.example' WHERE id = 'provider-1'
    `).run();
    const fetchImpl = (async () => Response.json({ models: [{ name: invalidName }] })) as typeof fetch;

    await assert.rejects(
      syncProviderModels(provider as any, 'key', dependencies(sqlite, fetchImpl)),
      /有效模型 ID/,
    );

    assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM models').get() as { n: number }).n, 0);
    assert.deepEqual(
      sqlite.prepare('SELECT model_id, source FROM provider_endpoint_models WHERE endpoint_id = ?').all(legacyId),
      [{ model_id: 'old-model', source: 'sync' }],
    );
    assert.deepEqual(
      sqlite.prepare('SELECT model_catalog_complete, models_observed_at FROM provider_endpoints WHERE id = ?').get(legacyId),
      { model_catalog_complete: 1, models_observed_at: 101 },
    );
    sqlite.close();
  });
}

test('a valid empty array replaces the synchronized catalog and marks it complete', async () => {
  const { sqlite, legacyId } = database();
  const fetchImpl = (async () => Response.json({ data: [] })) as typeof fetch;

  await syncProviderModels(provider as any, 'key', dependencies(sqlite, fetchImpl));

  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM provider_endpoint_models WHERE endpoint_id = ?').get(legacyId) as { n: number }).n, 0);
  assert.deepEqual(
    sqlite.prepare('SELECT model_catalog_complete, models_observed_at FROM provider_endpoints WHERE id = ?').get(legacyId),
    { model_catalog_complete: 1, models_observed_at: 500 },
  );
  sqlite.close();
});

test('a 200 response with the wrong shape fails without changing the previous catalog state', async () => {
  const { sqlite, legacyId } = database();
  const fetchImpl = (async () => Response.json({ error: { message: 'wrapped' } })) as typeof fetch;

  await assert.rejects(syncProviderModels(provider as any, 'key', dependencies(sqlite, fetchImpl)), /data.*数组/);

  assert.deepEqual(
    sqlite.prepare('SELECT model_id, source FROM provider_endpoint_models WHERE endpoint_id = ?').all(legacyId),
    [{ model_id: 'old-model', source: 'sync' }],
  );
  assert.deepEqual(
    sqlite.prepare('SELECT model_catalog_complete, models_observed_at FROM provider_endpoints WHERE id = ?').get(legacyId),
    { model_catalog_complete: 1, models_observed_at: 101 },
  );
  sqlite.close();
});

test('a later page failure performs no database writes', async () => {
  const { sqlite, legacyId } = database();
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return calls === 1
      ? Response.json({ data: [{ id: 'partial' }], has_more: true, last_id: 'cursor' })
      : new Response('failed page', { status: 502 });
  }) as typeof fetch;

  await assert.rejects(syncProviderModels(provider as any, 'key', dependencies(sqlite, fetchImpl)), /502/);
  assert.deepEqual(sqlite.prepare('SELECT model_id FROM provider_endpoint_models WHERE endpoint_id = ?').all(legacyId), [{ model_id: 'old-model' }]);
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM models').get() as { n: number }).n, 0);
  sqlite.close();
});

test('has_more without last_id and a repeated cursor are rejected', async () => {
  await assert.rejects(
    fetchAllUpstreamModels(provider as any, 'key', (async () => Response.json({ data: [], has_more: true })) as typeof fetch),
    /last_id/,
  );
  await assert.rejects(
    fetchAllUpstreamModels(provider as any, 'key', (async () => Response.json({ data: [], has_more: true, last_id: 'same' })) as typeof fetch),
    /分页游标循环/,
  );
});

test('default endpoint is resolved once before fetch and results are written back to that endpoint id', async () => {
  const { sqlite, legacyId } = database();
  const fetchImpl = (async (input: string | URL | Request) => {
    assert.equal(String(input), 'https://chat.example/v1/models');
    sqlite.exec(`
      UPDATE provider_endpoints SET is_default = CASE WHEN id = 'responses-id' THEN 1 ELSE 0 END;
      UPDATE providers SET protocol = 'openai-responses', base_url = 'https://responses.example/v1' WHERE id = 'provider-1';
    `);
    return Response.json({ data: [{ id: 'raced-model' }] });
  }) as typeof fetch;

  await syncProviderModels(provider as any, 'key', dependencies(sqlite, fetchImpl));

  assert.deepEqual(sqlite.prepare('SELECT model_id FROM provider_endpoint_models WHERE endpoint_id = ?').all(legacyId), [{ model_id: 'raced-model' }]);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM provider_endpoint_models WHERE endpoint_id = 'responses-id'").get() as { n: number }).n, 0);
  sqlite.close();
});

test('same endpoint ID changing URL during fetch aborts before model or catalog writes', async () => {
  const { sqlite, legacyId } = database();
  const fetchImpl = (async (input: string | URL | Request) => {
    assert.equal(String(input), 'https://chat.example/v1/models');
    sqlite.prepare('UPDATE provider_endpoints SET base_url = ? WHERE id = ?')
      .run('https://changed.example/v1', legacyId);
    sqlite.prepare('UPDATE providers SET base_url = ? WHERE id = ?')
      .run('https://changed.example/v1', 'provider-1');
    return Response.json({ data: [{ id: 'stale-origin-model' }] });
  }) as typeof fetch;

  await assert.rejects(
    syncProviderModels(provider as any, 'key', dependencies(sqlite, fetchImpl)),
    /端点配置已变更，请重试/,
  );

  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM models').get() as { n: number }).n, 0);
  assert.deepEqual(
    sqlite.prepare('SELECT model_id, source FROM provider_endpoint_models WHERE endpoint_id = ?').all(legacyId),
    [{ model_id: 'old-model', source: 'sync' }],
  );
  assert.deepEqual(
    sqlite.prepare('SELECT base_url, model_catalog_complete, models_observed_at FROM provider_endpoints WHERE id = ?').get(legacyId),
    { base_url: 'https://changed.example/v1', model_catalog_complete: 1, models_observed_at: 101 },
  );
  sqlite.close();
});

test('provider model insertion and endpoint catalog replacement roll back together', async () => {
  const { sqlite, legacyId } = database();
  sqlite.exec(`CREATE TRIGGER fail_catalog_insert BEFORE INSERT ON provider_endpoint_models
    WHEN NEW.model_id = 'new-model' BEGIN SELECT RAISE(ABORT, 'catalog write failed'); END;`);
  const fetchImpl = (async () => Response.json({ data: [{ id: 'new-model' }] })) as typeof fetch;

  await assert.rejects(syncProviderModels(provider as any, 'key', dependencies(sqlite, fetchImpl)), /catalog write failed/);

  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM models').get() as { n: number }).n, 0);
  assert.deepEqual(sqlite.prepare('SELECT model_id FROM provider_endpoint_models WHERE endpoint_id = ?').all(legacyId), [{ model_id: 'old-model' }]);
  assert.deepEqual(sqlite.prepare('SELECT model_catalog_complete, models_observed_at FROM provider_endpoints WHERE id = ?').get(legacyId), { model_catalog_complete: 1, models_observed_at: 101 });
  sqlite.close();
});

test('Bailian official prices are kept verbatim without inventing a USD unit', async () => {
  const { sqlite } = database();
  const prices = [
    { type: 'input_token', range_name: 'Default', price: 2 },
    { type: 'input_token', range_name: '32k<Input<=128k', price: 3 },
    { type: 'output_token', range_name: 'Default', price: 8 },
    // 未识别的计费项必须原样留存，不得映射也不得丢弃。
    { type: 'image_number', range_name: 'Default', price: 0.02 },
  ];
  const fetchImpl = (async () => Response.json({
    success: true,
    output: {
      total: 1,
      page_no: 1,
      page_size: 20,
      models: [{
        model: 'qwen3-max',
        name: '通义千问3-Max',
        description: '旗舰文本模型',
        provider: 'qwen',
        inference_provider: 'aliyun-bailian',
        published_time: '2026-01-01',
        capabilities: ['TG', 'Reasoning'],
        features: ['function-calling'],
        inference_metadata: { request_modality: ['Text', 'Image'], response_modality: ['Text'] },
        model_info: {
          context_window: 131072,
          max_input_tokens: 129024,
          max_output_tokens: 32768,
          max_reasoning_tokens: 16384,
        },
        prices,
      }],
    },
    request_id: 'request-prices',
  })) as typeof fetch;

  await syncProviderModels(bailianProvider as any, 'key', dependencies(sqlite, fetchImpl));

  const row = sqlite.prepare(`SELECT input_price, output_price, pricing_source, pricing_currency,
    pricing_tiers_json, capabilities_json FROM models WHERE model_id = 'qwen3-max'`).get() as Record<string, unknown>;

  // 全部阶梯与非 Token 项原样保留。
  assert.deepEqual(JSON.parse(String(row.pricing_tiers_json)), prices);
  assert.equal(row.pricing_source, 'aliyun-modelstudio');
  // 官方响应没有币种，也没说明单价的计量单位，所以扁平的「美元/百万 token」列必须留空。
  assert.equal(row.pricing_currency, null);
  assert.equal(row.input_price, null);
  assert.equal(row.output_price, null);

  const caps = JSON.parse(String(row.capabilities_json));
  assert.deepEqual(caps.modalities, ['Text', 'Image']);
  assert.deepEqual(caps.responseModalities, ['Text']);
  assert.equal(caps.maxInputTokens, 129024);
  assert.equal(caps.maxOutputTokens, 32768);
  assert.equal(caps.maxReasoningTokens, 16384);
  assert.equal(caps.description, '旗舰文本模型');
  assert.equal(caps.inferenceProvider, 'aliyun-bailian');
  sqlite.close();
});

test('Bailian real-shape prices land as per-million CNY unit prices', async () => {
  const { sqlite } = database();
  // 2026-09-19 用真实密钥核对过的结构：档位 → 计费项两层，带 price_unit 与 time_band。
  const prices = [{
    range_name: 'Default',
    prices: [
      { type: 'input_token', price: '2.1', price_unit: '每百万tokens', price_name: '输入', time_band: 'standard' },
      { type: 'output_token', price: '8.4', price_unit: '每百万tokens', price_name: '输出', time_band: 'standard' },
      { type: 'input_token_cache', price: '0.42', price_unit: '每百万tokens', price_name: '输入（缓存命中）', time_band: 'standard' },
      { type: 'input_token', price: '1.05', price_unit: '每百万tokens', price_name: '输入', time_band: 'discount' },
    ],
  }];
  const fetchImpl = (async () => Response.json({
    success: true,
    output: { total: 1, page_no: 1, page_size: 20, models: [{ model: 'MiniMax-M2.1', name: 'MiniMax-M2.1', prices }] },
    request_id: 'r',
  })) as typeof fetch;

  await syncProviderModels(bailianProvider as any, 'key', dependencies(sqlite, fetchImpl));

  const row = sqlite.prepare(`SELECT input_price, output_price, cache_read_price, pricing_currency,
    pricing_source, pricing_tiers_json FROM models WHERE model_id = 'MiniMax-M2.1'`).get() as Record<string, unknown>;
  assert.equal(row.input_price, 2.1);
  assert.equal(row.output_price, 8.4);
  assert.equal(row.cache_read_price, 0.42);   // input_token_cache 是官方的缓存读取 type
  assert.equal(row.pricing_currency, 'CNY');
  assert.equal(row.pricing_source, 'aliyun-modelstudio');
  // 优惠时段单价不能当常价。
  assert.notEqual(row.input_price, 1.05);
  // 原始阶梯仍然逐字留存。
  assert.deepEqual(JSON.parse(String(row.pricing_tiers_json)), prices);
  sqlite.close();
});

test('Bailian multi-band pricing keeps every tier and refuses a flat unit price', async () => {
  const { sqlite } = database();
  const prices = [
    { range_name: 'Default', prices: [{ type: 'input_token', price: '2', price_unit: '每百万tokens', time_band: 'standard' }] },
    { range_name: '32k<Input<=128k', prices: [{ type: 'input_token', price: '4', price_unit: '每百万tokens', time_band: 'standard' }] },
  ];
  const fetchImpl = (async () => Response.json({
    success: true,
    output: { total: 1, page_no: 1, page_size: 20, models: [{ model: 'qwen-long', name: 'qwen-long', prices }] },
    request_id: 'r',
  })) as typeof fetch;

  await syncProviderModels(bailianProvider as any, 'key', dependencies(sqlite, fetchImpl));

  const row = sqlite.prepare("SELECT input_price, pricing_tiers_json FROM models WHERE model_id = 'qwen-long'").get() as Record<string, unknown>;
  // 一次请求落在哪一档取决于实际用量，取任一档冒充固定单价都是错的。
  assert.equal(row.input_price, null);
  assert.deepEqual(JSON.parse(String(row.pricing_tiers_json)), prices);
  sqlite.close();
});

test('filtered sync prunes to the filter result but protects manual and aliased models', async () => {
  const { sqlite } = database();
  const seed = sqlite.prepare(
    "INSERT INTO models (id, provider_id, model_id, enabled, synced) VALUES (?, 'provider-1', ?, 1, ?)",
  );
  seed.run('keep-upstream', 'deepseek-r1', 1);   // 在筛选结果里
  seed.run('drop-me', 'qwen3-max', 1);           // 已同步但不在筛选结果里 → 删
  seed.run('manual-row', 'my-custom-model', 0);  // 手动添加 → 保留
  seed.run('aliased-row', 'qwen3-plus', 1);      // 被别名引用 → 保留
  sqlite.prepare("INSERT INTO route_aliases (id, alias, targets) VALUES ('a1', 'best', ?)")
    .run(JSON.stringify([{ provider_id: 'provider-1', model_id: 'qwen3-plus' }]));

  const fetchImpl = (async () => Response.json({
    success: true,
    output: { total: 1, page_no: 1, page_size: 20, models: [{ model: 'deepseek-r1', name: 'DeepSeek R1' }] },
    request_id: 'r',
  })) as typeof fetch;

  const result = await syncProviderModels(
    bailianProvider as any, 'key', dependencies(sqlite, fetchImpl),
    { providers: ['deepseek'] }, { prune: true },
  );

  assert.equal(result.removed, 1);
  assert.equal(result.kept_manual, 1);
  assert.equal(result.kept_referenced, 1);
  assert.deepEqual(
    sqlite.prepare('SELECT model_id FROM models ORDER BY model_id').all().map((r: any) => r.model_id),
    ['deepseek-r1', 'my-custom-model', 'qwen3-plus'],
  );
  sqlite.close();
});

test('sync without prune never deletes, it only counts', async () => {
  const { sqlite } = database();
  sqlite.prepare("INSERT INTO models (id, provider_id, model_id, enabled, synced) VALUES ('x', 'provider-1', 'qwen3-max', 1, 1)").run();
  const fetchImpl = (async () => Response.json({
    success: true,
    output: { total: 1, page_no: 1, page_size: 20, models: [{ model: 'deepseek-r1', name: 'DeepSeek R1' }] },
    request_id: 'r',
  })) as typeof fetch;

  const result = await syncProviderModels(bailianProvider as any, 'key', dependencies(sqlite, fetchImpl));

  assert.equal(result.removed, 0);
  assert.equal(result.removed_not_in_upstream, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM models WHERE model_id = 'qwen3-max'").get() as any).n, 1);
  sqlite.close();
});

test('an unparseable route alias aborts the prune instead of deleting blindly', async () => {
  const { sqlite } = database();
  sqlite.prepare("INSERT INTO models (id, provider_id, model_id, enabled, synced) VALUES ('x', 'provider-1', 'qwen3-max', 1, 1)").run();
  sqlite.prepare("INSERT INTO route_aliases (id, alias, targets) VALUES ('bad', 'broken', 'not json')").run();
  const fetchImpl = (async () => Response.json({
    success: true,
    output: { total: 1, page_no: 1, page_size: 20, models: [{ model: 'deepseek-r1', name: 'DeepSeek R1' }] },
    request_id: 'r',
  })) as typeof fetch;

  await assert.rejects(
    syncProviderModels(bailianProvider as any, 'key', dependencies(sqlite, fetchImpl), {}, { prune: true }),
    /路由别名/,
  );
  // 事务回滚，什么都没动。
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM models WHERE model_id = 'qwen3-max'").get() as any).n, 1);
  sqlite.close();
});

test('syncing refreshes bundled pricing on existing models but never touches manual or subscription rows', async () => {
  const { sqlite } = database();
  const seed = sqlite.prepare(
    `INSERT INTO models (id, provider_id, model_id, enabled, synced, input_price, output_price, pricing_source)
     VALUES (?, 'provider-1', ?, 1, 1, ?, ?, ?)`,
  );
  seed.run('stale', 'model-a', 1, 2, 'cc-switch-global');   // 旧价 → 应被刷新
  seed.run('fresh', 'model-b', null, null, null);           // 无来源 → 应被写入
  seed.run('mine', 'model-c', 9, 9, 'manual');              // 手填 → 不许动
  seed.run('sub', 'model-d', 5, 5, 'subscription');         // 订阅 → 不许动

  const fetchImpl = (async () => Response.json({
    data: [{ id: 'model-a' }, { id: 'model-b' }, { id: 'model-c' }, { id: 'model-d' }],
    has_more: false,
  })) as typeof fetch;
  const deps = dependencies(sqlite, fetchImpl);
  deps.lookupPricing = () => ({ input: 7, output: 8, cacheRead: 0.7, cacheWrite: null, source: 'cc-switch-provider' });

  const result = await syncProviderModels(provider as any, 'key', deps);

  assert.equal(result.added, 0);
  assert.equal(result.repriced, 2);
  assert.deepEqual(
    sqlite.prepare('SELECT model_id, input_price, output_price, pricing_source FROM models ORDER BY model_id').all(),
    [
      { model_id: 'model-a', input_price: 7, output_price: 8, pricing_source: 'cc-switch-provider' },
      { model_id: 'model-b', input_price: 7, output_price: 8, pricing_source: 'cc-switch-provider' },
      { model_id: 'model-c', input_price: 9, output_price: 9, pricing_source: 'manual' },
      { model_id: 'model-d', input_price: 5, output_price: 5, pricing_source: 'subscription' },
    ],
  );
  sqlite.close();
});

test('a bundled-price miss clears the cc-switch rows it owns, matching boot-time behaviour', async () => {
  const { sqlite } = database();
  sqlite.prepare(
    `INSERT INTO models (id, provider_id, model_id, enabled, synced, input_price, pricing_source)
     VALUES ('gone', 'provider-1', 'model-a', 1, 1, 3, 'cc-switch-global')`,
  ).run();
  const fetchImpl = (async () => Response.json({ data: [{ id: 'model-a' }], has_more: false })) as typeof fetch;
  const deps = dependencies(sqlite, fetchImpl);
  deps.lookupPricing = () => null;

  await syncProviderModels(provider as any, 'key', deps);

  const row = sqlite.prepare("SELECT input_price, pricing_source FROM models WHERE id = 'gone'").get() as Record<string, unknown>;
  assert.equal(row.input_price, null);
  assert.equal(row.pricing_source, null);
  sqlite.close();
});

test('an official catalog corrects a stale context window but leaves the display label alone', async () => {
  const { sqlite } = database();
  sqlite.prepare(`INSERT INTO models (id, provider_id, model_id, display_name, context_window, enabled, synced)
    VALUES ('stale', 'provider-1', 'k3', '我改过的名字', 256000, 1, 1)`).run();
  sqlite.prepare("UPDATE providers SET base_url='https://api.kimi.com/coding/v1' WHERE id='provider-1'").run();
  sqlite.prepare("UPDATE provider_endpoints SET base_url='https://api.kimi.com/coding/v1' WHERE provider_id='provider-1' AND is_default=1").run();

  const fetchImpl = (async () => Response.json({
    data: [{ id: 'k3', display_name: 'K3', context_length: 1048576, supports_dynamic_tools: true }],
  })) as typeof fetch;

  await syncProviderModels(provider as any, 'key', dependencies(sqlite, fetchImpl));

  const row = sqlite.prepare("SELECT display_name, context_window FROM models WHERE id = 'stale'").get() as Record<string, unknown>;
  // 上下文长度是事实，跟上游走
  assert.equal(row.context_window, 1048576);
  // 展示名是标签，用户改过就不动
  assert.equal(row.display_name, '我改过的名字');
  sqlite.close();
});
