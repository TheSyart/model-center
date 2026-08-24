import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { migrateProviderEndpointSchema } from '../lib/db/provider-endpoint-migration.ts';
import {
  EndpointValidationError,
  getEnabledDefaultEndpoint,
  listProviderEndpointModelObservations,
  listProviderEndpoints,
  materializePresetEndpoints,
  replaceEndpointModelCatalog,
  replaceProviderEndpoints,
  validateCompleteEndpointSet,
} from '../lib/services/provider-endpoint.ts';
import { resolveEndpointSetForCreate, resolveEndpointSetForPatch } from '../lib/services/provider-endpoint-request.ts';
import { serializeProviderRecord } from '../lib/services/provider-serialization.ts';
import type { ProviderPreset } from '../lib/presets/types.ts';

function database() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE providers (
      id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      protocol TEXT NOT NULL, base_url TEXT NOT NULL, api_key_enc TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER, updated_at INTEGER
    );
  `);
  sqlite.prepare(`INSERT INTO providers
    (id, slug, name, protocol, base_url, api_key_enc, enabled, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'provider-1', 'example', 'Example', 'openai', 'https://old.example/v1', 'ciphertext', 1, 0,
  );
  migrateProviderEndpointSchema(sqlite, 100);
  return sqlite;
}

const multiProtocolPreset: ProviderPreset = {
  presetKey: 'example-preset', slug: 'example-preset', name: 'Example preset', category: 'official',
  protocol: 'openai', baseUrl: 'https://chat.example/v1', defaultProtocol: 'openai', legacySlugs: [],
  endpoints: [
    {
      protocol: 'openai', baseUrl: 'https://chat.example/v1', selectedVariantSlug: 'example-chat', sourceApps: ['opencode'],
      knownModels: [{ id: 'chat-positive' }], modelCatalogComplete: false, alternateCandidates: [],
    },
    {
      protocol: 'anthropic', baseUrl: 'https://claude.example', selectedVariantSlug: 'example-claude', sourceApps: ['claude'],
      knownModels: [{ id: 'claude-positive' }], modelCatalogComplete: false, alternateCandidates: [],
    },
  ],
};

test('complete endpoint validation rejects duplicate protocols, invalid URLs, and non-enabled defaults', () => {
  const expectValidationFailure = (endpoints: Parameters<typeof validateCompleteEndpointSet>[0]) => {
    assert.throws(() => validateCompleteEndpointSet(endpoints), EndpointValidationError);
  };

  expectValidationFailure([
    { protocol: 'openai', base_url: 'https://one.example/v1', enabled: true, is_default: true },
    { protocol: 'openai', base_url: 'https://two.example/v1', enabled: true, is_default: false },
  ]);
  expectValidationFailure([{ protocol: 'openai', base_url: 'http://private.example/v1', enabled: true, is_default: true }]);
  expectValidationFailure([{ protocol: 'openai', base_url: 'https://one.example/v1', enabled: false, is_default: true }]);
});

test('endpoint replacement atomically updates the compatibility projection and preserves it on SQLite failure', () => {
  const sqlite = database();
  const endpoints = validateCompleteEndpointSet([
    { protocol: 'openai', base_url: 'https://chat.example/v1', enabled: true, is_default: true },
    { protocol: 'anthropic', base_url: 'https://claude.example', enabled: true, is_default: false },
  ]);
  replaceProviderEndpoints(sqlite, 'provider-1', endpoints, 200);

  assert.deepEqual(
    sqlite.prepare('SELECT protocol, base_url FROM providers WHERE id = ?').get('provider-1'),
    { protocol: 'openai', base_url: 'https://chat.example/v1' },
  );
  const defaultEndpoint = getEnabledDefaultEndpoint(sqlite, 'provider-1');
  assert.equal(defaultEndpoint?.providerId, 'provider-1');
  assert.equal(defaultEndpoint?.protocol, 'openai');
  assert.equal(defaultEndpoint?.baseUrl, 'https://chat.example/v1');
  assert.equal(defaultEndpoint?.isDefault, true);

  sqlite.exec(`CREATE TRIGGER reject_anthropic_endpoint BEFORE INSERT ON provider_endpoints
    WHEN NEW.protocol = 'gemini' BEGIN SELECT RAISE(ABORT, 'endpoint rejected'); END;`);
  const rejected = validateCompleteEndpointSet([
    { protocol: 'gemini', base_url: 'https://gemini.example', enabled: true, is_default: true },
  ]);
  assert.throws(() => replaceProviderEndpoints(sqlite, 'provider-1', rejected, 300), /endpoint rejected/);
  assert.deepEqual(
    sqlite.prepare('SELECT protocol, base_url FROM providers WHERE id = ?').get('provider-1'),
    { protocol: 'openai', base_url: 'https://chat.example/v1' },
  );
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM provider_endpoints').get() as { n: number }).n, 2);
  sqlite.close();
});

test('legacy POST and PATCH shapes deterministically convert to complete endpoint sets', () => {
  const getPreset = (key: string) => key === multiProtocolPreset.presetKey ? multiProtocolPreset : undefined;
  assert.deepEqual(
    resolveEndpointSetForCreate({ protocol: 'openai-responses', base_url: 'https://responses.example/v1' }, getPreset),
    [{ protocol: 'openai-responses', base_url: 'https://responses.example/v1', enabled: true, is_default: true }],
  );
  assert.deepEqual(
    resolveEndpointSetForPatch(
      { base_url: 'https://responses.example/v2' },
      [{
        id: 'endpoint-1', providerId: 'provider-1', protocol: 'openai-responses', baseUrl: 'https://responses.example/v1',
        enabled: true, isDefault: true, presetVariantSlug: null, sourceRef: null, modelCatalogComplete: false,
        modelsObservedAt: null, createdAt: 1, updatedAt: 1,
      }],
      getPreset,
    ),
    [{
      protocol: 'openai-responses', base_url: 'https://responses.example/v2', enabled: true, is_default: true,
      preset_variant_slug: null, source_ref: null, model_catalog_complete: false, models_observed_at: null,
    }],
  );
  const presetEndpoints = resolveEndpointSetForCreate({ preset_key: 'example-preset' }, getPreset);
  assert.equal(presetEndpoints?.length, 2);
  assert.equal(presetEndpoints?.find((endpoint) => endpoint.protocol === 'openai')?.models?.[0]?.source, 'preset');
  assert.throws(
    () => resolveEndpointSetForCreate({ preset_key: 'missing-preset' }, getPreset),
    /不支持或不存在/,
  );
});

test('PATCH default_protocol alone changes the enabled default and compatibility projection', () => {
  const sqlite = database();
  replaceProviderEndpoints(sqlite, 'provider-1', [
    { protocol: 'openai', base_url: 'https://chat.example/v1', enabled: true, is_default: true },
    { protocol: 'anthropic', base_url: 'https://claude.example', enabled: true, is_default: false },
  ], 500);

  const endpoints = resolveEndpointSetForPatch(
    { default_protocol: 'anthropic' },
    listProviderEndpoints(sqlite, 'provider-1'),
    () => undefined,
  );
  assert.ok(endpoints);
  replaceProviderEndpoints(sqlite, 'provider-1', endpoints, 501);
  assert.deepEqual(
    sqlite.prepare('SELECT protocol, base_url FROM providers WHERE id = ?').get('provider-1'),
    { protocol: 'anthropic', base_url: 'https://claude.example' },
  );
  assert.deepEqual(
    sqlite.prepare('SELECT protocol, is_default FROM provider_endpoints ORDER BY protocol').all(),
    [{ protocol: 'anthropic', is_default: 1 }, { protocol: 'openai', is_default: 0 }],
  );
  sqlite.close();
});

test('PATCH default_protocol rejects a disabled target endpoint', () => {
  assert.throws(
    () => resolveEndpointSetForPatch(
      { default_protocol: 'anthropic' },
      [
        {
          id: 'openai', providerId: 'provider-1', protocol: 'openai', baseUrl: 'https://chat.example/v1',
          enabled: true, isDefault: true, presetVariantSlug: null, sourceRef: null, modelCatalogComplete: false,
          modelsObservedAt: null, createdAt: 1, updatedAt: 1,
        },
        {
          id: 'anthropic', providerId: 'provider-1', protocol: 'anthropic', baseUrl: 'https://claude.example',
          enabled: false, isDefault: false, presetVariantSlug: null, sourceRef: null, modelCatalogComplete: false,
          modelsObservedAt: null, createdAt: 1, updatedAt: 1,
        },
      ],
      () => undefined,
    ),
    /默认端点必须启用/,
  );
});

test('endpoint request parsing rejects malformed boolean, protocol, and base_url values', () => {
  const getPreset = () => undefined;
  for (const endpoints of [
    [{ protocol: 'openai', base_url: 'https://chat.example/v1', enabled: 'false', is_default: true }],
    [{ protocol: 'openai', base_url: 'https://chat.example/v1', enabled: true, is_default: 0 }],
    [{ protocol: 42, base_url: 'https://chat.example/v1', enabled: true, is_default: true }],
    [{ protocol: 'openai', base_url: null, enabled: true, is_default: true }],
  ]) {
    assert.throws(
      () => resolveEndpointSetForCreate({ endpoints }, getPreset),
      EndpointValidationError,
    );
  }
});

test('configuration-only endpoint replacement preserves sync catalog state and models', () => {
  const sqlite = database();
  replaceProviderEndpoints(sqlite, 'provider-1', [
    { protocol: 'openai', base_url: 'https://chat.example/v1', enabled: true, is_default: true },
  ], 600);
  const endpointId = (sqlite.prepare('SELECT id FROM provider_endpoints WHERE provider_id = ?').get('provider-1') as { id: string }).id;
  sqlite.prepare('UPDATE provider_endpoints SET model_catalog_complete = 1, models_observed_at = 601 WHERE id = ?').run(endpointId);
  sqlite.prepare('INSERT INTO provider_endpoint_models (endpoint_id, model_id, source, observed_at) VALUES (?, ?, ?, ?)')
    .run(endpointId, 'synced-model', 'sync', 601);

  replaceProviderEndpoints(sqlite, 'provider-1', [
    { protocol: 'openai', base_url: 'https://chat.example/v2', enabled: true, is_default: true },
  ], 602);
  assert.deepEqual(
    sqlite.prepare('SELECT base_url, model_catalog_complete, models_observed_at FROM provider_endpoints WHERE id = ?').get(endpointId),
    { base_url: 'https://chat.example/v2', model_catalog_complete: 1, models_observed_at: 601 },
  );
  assert.deepEqual(
    sqlite.prepare('SELECT model_id, source FROM provider_endpoint_models WHERE endpoint_id = ?').all(endpointId),
    [{ model_id: 'synced-model', source: 'sync' }],
  );
  sqlite.close();
});

test('same-protocol preset switch replaces preset models without deleting sync models', () => {
  const sqlite = database();
  const firstPreset: ProviderPreset = {
    ...multiProtocolPreset,
    presetKey: 'first-preset', slug: 'first-preset', endpoints: [{
      ...multiProtocolPreset.endpoints[0], knownModels: [{ id: 'first-preset-model' }],
    }],
  };
  const secondPreset: ProviderPreset = {
    ...firstPreset,
    presetKey: 'second-preset', slug: 'second-preset', endpoints: [{
      ...firstPreset.endpoints[0], selectedVariantSlug: 'second-variant', knownModels: [{ id: 'second-preset-model' }],
    }],
  };
  replaceProviderEndpoints(sqlite, 'provider-1', materializePresetEndpoints(firstPreset), 700);
  const endpointId = (sqlite.prepare('SELECT id FROM provider_endpoints WHERE provider_id = ?').get('provider-1') as { id: string }).id;
  sqlite.prepare('UPDATE provider_endpoints SET model_catalog_complete = 1, models_observed_at = 701 WHERE id = ?').run(endpointId);
  sqlite.prepare('INSERT INTO provider_endpoint_models (endpoint_id, model_id, source, observed_at) VALUES (?, ?, ?, ?)')
    .run(endpointId, 'synced-model', 'sync', 701);

  const endpoints = resolveEndpointSetForPatch(
    { preset_key: 'second-preset' },
    listProviderEndpoints(sqlite, 'provider-1'),
    (key) => key === 'second-preset' ? secondPreset : undefined,
  );
  assert.ok(endpoints);
  replaceProviderEndpoints(sqlite, 'provider-1', endpoints, 702);
  assert.deepEqual(
    sqlite.prepare('SELECT model_catalog_complete, models_observed_at FROM provider_endpoints WHERE id = ?').get(endpointId),
    { model_catalog_complete: 1, models_observed_at: 701 },
  );
  assert.deepEqual(
    sqlite.prepare('SELECT model_id, source FROM provider_endpoint_models WHERE endpoint_id = ? ORDER BY model_id').all(endpointId),
    [
      { model_id: 'second-preset-model', source: 'preset' },
      { model_id: 'synced-model', source: 'sync' },
    ],
  );
  sqlite.close();
});

test('preset seeding never downgrades an overlapping sync model during a preset switch', () => {
  const sqlite = database();
  const firstPreset: ProviderPreset = {
    ...multiProtocolPreset,
    presetKey: 'overlap-first', slug: 'overlap-first', endpoints: [{
      ...multiProtocolPreset.endpoints[0], knownModels: [{ id: 'overlap-model' }],
    }],
  };
  const secondPreset: ProviderPreset = {
    ...firstPreset,
    presetKey: 'overlap-second', slug: 'overlap-second', endpoints: [{
      ...firstPreset.endpoints[0], selectedVariantSlug: 'overlap-second-variant',
      knownModels: [{ id: 'overlap-model' }, { id: 'second-preset-model' }],
    }],
  };
  replaceProviderEndpoints(sqlite, 'provider-1', materializePresetEndpoints(firstPreset), 750);
  replaceProviderEndpoints(sqlite, 'provider-1', [{
    protocol: 'openai', base_url: 'https://chat.example/v1', enabled: true, is_default: true,
    models: [{ model_id: 'overlap-model', source: 'sync' }],
  }], 751);

  const endpoints = resolveEndpointSetForPatch(
    { preset_key: 'overlap-second' },
    listProviderEndpoints(sqlite, 'provider-1'),
    (key) => key === 'overlap-second' ? secondPreset : undefined,
  );
  assert.ok(endpoints);
  replaceProviderEndpoints(sqlite, 'provider-1', endpoints, 752);
  assert.deepEqual(
    sqlite.prepare(`
      SELECT model_id, source FROM provider_endpoint_models
      WHERE endpoint_id = (SELECT id FROM provider_endpoints WHERE provider_id = ? AND protocol = 'openai')
      ORDER BY model_id
    `).all('provider-1'),
    [
      { model_id: 'overlap-model', source: 'sync' },
      { model_id: 'second-preset-model', source: 'preset' },
    ],
  );
  sqlite.close();
});

test('preset materialization produces a single enabled default and seeds positive preset model knowledge', () => {
  const sqlite = database();
  const endpoints = materializePresetEndpoints(multiProtocolPreset);
  replaceProviderEndpoints(sqlite, 'provider-1', endpoints, 400);

  assert.deepEqual(
    sqlite.prepare('SELECT protocol, base_url, is_default, model_catalog_complete, source_ref FROM provider_endpoints ORDER BY protocol').all(),
    [
      { protocol: 'anthropic', base_url: 'https://claude.example', is_default: 0, model_catalog_complete: 0, source_ref: 'example-preset' },
      { protocol: 'openai', base_url: 'https://chat.example/v1', is_default: 1, model_catalog_complete: 0, source_ref: 'example-preset' },
    ],
  );
  assert.deepEqual(
    sqlite.prepare('SELECT model_id, source FROM provider_endpoint_models ORDER BY model_id').all(),
    [{ model_id: 'chat-positive', source: 'preset' }, { model_id: 'claude-positive', source: 'preset' }],
  );
  sqlite.close();
});

test('provider serialization exposes endpoint defaults without leaking encrypted keys', () => {
  const serialized = serializeProviderRecord(
    {
      id: 'provider-1', slug: 'example', name: 'Example', protocol: 'openai', baseUrl: 'https://chat.example/v1',
      presetKey: 'example-preset', apiKeyEnc: 'encrypted-secret', enabled: 1, priority: 2,
      balanceConfig: null, remark: null, createdAt: 10, updatedAt: 20,
    },
    [{
      id: 'endpoint-1', providerId: 'provider-1', protocol: 'openai', baseUrl: 'https://chat.example/v1',
      enabled: true, isDefault: true, presetVariantSlug: 'variant-1', sourceRef: 'example-preset',
      modelCatalogComplete: false, modelsObservedAt: null, createdAt: 10, updatedAt: 20,
    }],
  );
  assert.equal(serialized.default_protocol, 'openai');
  assert.equal(serialized.default_base_url, 'https://chat.example/v1');
  assert.equal(serialized.protocol, serialized.default_protocol);
  assert.equal(serialized.base_url, serialized.default_base_url);
  assert.equal(serialized.endpoints.length, 1);
  assert.equal(serialized.has_key, true);
  assert.equal('apiKeyEnc' in serialized, false);
  assert.equal('api_key_enc' in serialized, false);
});

test('model synchronization atomically replaces only the default endpoint catalog', () => {
  const sqlite = database();
  replaceProviderEndpoints(sqlite, 'provider-1', [
    { protocol: 'openai', base_url: 'https://chat.example/v1', enabled: true, is_default: true },
    { protocol: 'anthropic', base_url: 'https://claude.example', enabled: true, is_default: false,
      models: [{ model_id: 'preset-claude', source: 'preset' }] },
  ], 900);
  const defaultId = (sqlite.prepare("SELECT id FROM provider_endpoints WHERE provider_id = ? AND protocol = 'openai'").get('provider-1') as { id: string }).id;
  sqlite.prepare('INSERT INTO provider_endpoint_models (endpoint_id, model_id, source, observed_at) VALUES (?, ?, ?, ?)')
    .run(defaultId, 'stale-sync-model', 'sync', 901);

  replaceEndpointModelCatalog(sqlite, defaultId, ['fresh-a', 'fresh-b'], 902);

  assert.deepEqual(
    sqlite.prepare('SELECT model_catalog_complete, models_observed_at FROM provider_endpoints WHERE id = ?').get(defaultId),
    { model_catalog_complete: 1, models_observed_at: 902 },
  );
  assert.deepEqual(
    sqlite.prepare('SELECT model_id, source FROM provider_endpoint_models WHERE endpoint_id = ? ORDER BY model_id').all(defaultId),
    [{ model_id: 'fresh-a', source: 'sync' }, { model_id: 'fresh-b', source: 'sync' }],
  );
  assert.deepEqual(
    sqlite.prepare("SELECT model_id, source FROM provider_endpoint_models WHERE model_id = 'preset-claude'").all(),
    [{ model_id: 'preset-claude', source: 'preset' }],
  );
  sqlite.close();
});

test('endpoint model observations use the selector field names', () => {
  const sqlite = database();
  replaceProviderEndpoints(sqlite, 'provider-1', [
    { protocol: 'openai', base_url: 'https://chat.example/v1', enabled: true, is_default: true,
      models: [{ model_id: 'known-model', source: 'preset' }] },
  ], 950);

  const endpointId = (sqlite.prepare('SELECT id FROM provider_endpoints WHERE provider_id = ?').get('provider-1') as { id: string }).id;
  assert.deepEqual(listProviderEndpointModelObservations(sqlite, 'provider-1'), [{ endpointId, modelId: 'known-model' }]);
  sqlite.close();
});
