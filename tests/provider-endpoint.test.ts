import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { migrateProviderEndpointSchema } from '../lib/db/provider-endpoint-migration.ts';
import {
  EndpointValidationError,
  getEnabledDefaultEndpoint,
  materializePresetEndpoints,
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
      preset_variant_slug: null, source_ref: null, model_catalog_complete: false,
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
