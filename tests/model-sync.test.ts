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
      context_window INTEGER, synced INTEGER NOT NULL DEFAULT 0,
      UNIQUE(provider_id, model_id)
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
