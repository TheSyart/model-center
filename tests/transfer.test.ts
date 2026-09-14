import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { createTransferService } from '../lib/services/transfer-core.ts';
import { validateProviderBaseUrl } from '../lib/services/provider-url.ts';
import type { ProviderPreset } from '../lib/presets/types.ts';

const preset: ProviderPreset = {
  presetKey: 'example-preset',
  slug: 'example',
  name: 'Example',
  protocol: 'openai',
  baseUrl: 'https://chat.example/v1',
  defaultProtocol: 'openai',
  legacySlugs: ['example-chat'],
  category: 'official',
  endpoints: [{
    protocol: 'openai',
    baseUrl: 'https://chat.example/v1',
    selectedVariantSlug: 'example-chat',
    sourceApps: ['opencode'],
    knownModels: [{ id: 'preset-model' }],
    modelCatalogComplete: false,
    alternateCandidates: [],
  }],
};

function database() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE providers (
      id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      protocol TEXT NOT NULL, base_url TEXT NOT NULL, preset_key TEXT,
      api_key_enc TEXT NOT NULL, enabled INTEGER NOT NULL, priority INTEGER NOT NULL,
      balance_config TEXT, remark TEXT, created_at INTEGER, updated_at INTEGER
    );
    CREATE TABLE provider_endpoints (
      id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      protocol TEXT NOT NULL, base_url TEXT NOT NULL, enabled INTEGER NOT NULL,
      is_default INTEGER NOT NULL, preset_variant_slug TEXT, source_ref TEXT,
      model_catalog_complete INTEGER NOT NULL DEFAULT 0, models_observed_at INTEGER,
      created_at INTEGER, updated_at INTEGER, UNIQUE(provider_id, protocol)
    );
    CREATE TABLE provider_endpoint_models (
      endpoint_id TEXT NOT NULL REFERENCES provider_endpoints(id) ON DELETE CASCADE,
      model_id TEXT NOT NULL, source TEXT NOT NULL, observed_at INTEGER,
      PRIMARY KEY(endpoint_id, model_id)
    );
    CREATE TABLE models (
      id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, model_id TEXT NOT NULL,
      alias TEXT, display_name TEXT, enabled INTEGER NOT NULL,
      input_price REAL, output_price REAL, cache_read_price REAL, cache_write_price REAL,
      pricing_source TEXT, pricing_source_ref TEXT, pricing_synced_at INTEGER,
      context_window INTEGER, synced INTEGER NOT NULL, UNIQUE(provider_id, model_id)
    );
    CREATE TABLE route_aliases (id TEXT PRIMARY KEY, alias TEXT UNIQUE NOT NULL, targets TEXT NOT NULL, enabled INTEGER NOT NULL);
    CREATE TABLE prompts (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, content TEXT NOT NULL, description TEXT, created_at INTEGER, updated_at INTEGER);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
  `);
  return sqlite;
}

function service(sqlite: Database.Database, allowHttp = false) {
  let id = 0;
  return createTransferService({
    sqlite,
    getPreset: (key) => key === preset.presetKey || key === preset.slug ? preset : undefined,
    encrypt: (value) => `enc:${value}`,
    decrypt: (value) => value.replace(/^enc:/, ''),
    randomId: () => `id-${++id}`,
    now: () => 1000,
    getLogRetentionDays: () => 30,
    setSetting: (key, value) => sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value),
    validateBaseUrl: (baseUrl) => validateProviderBaseUrl(baseUrl, allowHttp),
  });
}

test('v3 export round-trips client-owned endpoints and a preset-backed import seeds positive knowledge', () => {
  const source = database();
  const sourceTransfer = service(source);
  const imported = sourceTransfer.importConfig({
    version: 3,
    providers: [{
      slug: 'example', name: 'Example', preset_key: 'example-preset', default_protocol: 'anthropic', api_key: 'secret',
      endpoints: [
        { protocol: 'openai', base_url: 'https://chat.example/v1', enabled: true },
        { protocol: 'anthropic', base_url: 'https://claude.example', enabled: true },
      ],
    }],
  });
  assert.equal(imported.providers.added, 1);

  const exported = sourceTransfer.exportConfig(true);
  assert.equal(exported.version, 3);
  assert.deepEqual(exported.providers[0]?.endpoints, [
    { protocol: 'anthropic', base_url: 'https://claude.example', enabled: true },
    { protocol: 'openai', base_url: 'https://chat.example/v1', enabled: true },
  ]);
  assert.equal(exported.providers[0]?.default_protocol, 'anthropic');
  assert.equal('id' in (exported.providers[0]?.endpoints[0] ?? {}), false);

  const target = database();
  const targetTransfer = service(target);
  const report = targetTransfer.importConfig(exported);
  assert.equal(report.providers.added, 1);
  assert.deepEqual(
    target.prepare('SELECT protocol, base_url FROM providers WHERE slug = ?').get('example'),
    { protocol: 'anthropic', base_url: 'https://claude.example' },
  );
  assert.deepEqual(
    target.prepare('SELECT protocol, is_default FROM provider_endpoints ORDER BY protocol').all(),
    [{ protocol: 'anthropic', is_default: 1 }, { protocol: 'openai', is_default: 0 }],
  );
  assert.deepEqual(
    target.prepare('SELECT model_id, source FROM provider_endpoint_models').all(),
    [{ model_id: 'preset-model', source: 'preset' }],
  );
  source.close();
  target.close();
});

test('legacy v2 providers convert to one default endpoint', () => {
  const sqlite = database();
  const report = service(sqlite).importConfig({
    version: 2,
    providers: [{ slug: 'legacy', name: 'Legacy', protocol: 'openai-responses', base_url: 'https://legacy.example/v1', api_key: 'secret' }],
  });
  assert.equal(report.providers.added, 1);
  assert.deepEqual(
    sqlite.prepare('SELECT protocol, base_url, is_default, enabled FROM provider_endpoints').all(),
    [{ protocol: 'openai-responses', base_url: 'https://legacy.example/v1', is_default: 1, enabled: 1 }],
  );
  sqlite.close();
});

test('prompt import preserves non-empty content exactly, including intentional whitespace', () => {
  const sqlite = database();
  const report = service(sqlite).importConfig({ version: 3, prompts: [{ name: 'Whitespace', content: '  preserve\n  layout  ' }] });
  assert.equal(report.prompts.added, 1);
  assert.equal((sqlite.prepare('SELECT content FROM prompts WHERE name = ?').get('Whitespace') as { content: string }).content, '  preserve\n  layout  ');
  sqlite.close();
});

test('invalid imported endpoints roll back the provider insertion transaction', () => {
  const sqlite = database();
  sqlite.exec("CREATE TRIGGER reject_endpoint BEFORE INSERT ON provider_endpoints BEGIN SELECT RAISE(ABORT, 'endpoint rejected'); END;");
  const report = service(sqlite).importConfig({
    version: 3,
    providers: [{
      slug: 'rollback', name: 'Rollback', api_key: 'secret', default_protocol: 'openai',
      endpoints: [{ protocol: 'openai', base_url: 'https://rollback.example/v1', enabled: true }],
    }],
  });
  assert.equal(report.providers.added, 0);
  assert.match(report.providers.skipped[0]?.reason ?? '', /endpoint rejected/);
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM providers').get() as { n: number }).n, 0);
  sqlite.close();
});

test('HTTP provider import follows the runtime allow_http_providers policy for v3 and legacy shapes', () => {
  const allowed = database();
  const allowedReport = service(allowed, true).importConfig({
    version: 3,
    providers: [
      {
        slug: 'v3-http', name: 'V3 HTTP', api_key: 'secret', default_protocol: 'openai',
        endpoints: [{ protocol: 'openai', base_url: 'http://remote.example/v1', enabled: true }],
      },
      {
        slug: 'legacy-http', name: 'Legacy HTTP', api_key: 'secret',
        protocol: 'openai', base_url: 'http://legacy.example/v1',
      },
    ],
  });
  assert.equal(allowedReport.providers.added, 2);
  assert.deepEqual(
    allowed.prepare('SELECT slug, base_url FROM providers ORDER BY slug').all(),
    [
      { slug: 'legacy-http', base_url: 'http://legacy.example/v1' },
      { slug: 'v3-http', base_url: 'http://remote.example/v1' },
    ],
  );
  allowed.close();

  const denied = database();
  const deniedReport = service(denied, false).importConfig({
    version: 3,
    providers: [{
      slug: 'denied-http', name: 'Denied HTTP', api_key: 'secret', default_protocol: 'openai',
      endpoints: [{ protocol: 'openai', base_url: 'http://remote.example/v1', enabled: true }],
    }],
  });
  assert.equal(deniedReport.providers.added, 0);
  assert.match(deniedReport.providers.skipped[0]?.reason ?? '', /https/);
  assert.equal((denied.prepare('SELECT COUNT(*) AS n FROM providers').get() as { n: number }).n, 0);
  denied.close();
});

test('OAuth configuration is excluded from portable exports, with valid API-key fallback aliases retained',()=>{
 const sqlite=database();const transfer=service(sqlite);
 transfer.importConfig({providers:[{slug:'key-provider',protocol:'openai',base_url:'https://key.example/v1',api_key:'secret'},{slug:'oauth-provider',protocol:'openai-responses',base_url:'https://chatgpt.com/backend-api/codex',api_key:'temporary'}],models:[{provider_slug:'key-provider',model_id:'key-model'},{provider_slug:'oauth-provider',model_id:'oauth-model'}],aliases:[{alias:'mixed',targets:[{provider_slug:'oauth-provider',model_id:'oauth-model'},{provider_slug:'key-provider',model_id:'key-model'}]},{alias:'only-oauth',targets:[{provider_slug:'oauth-provider',model_id:'oauth-model'}]}]});
 sqlite.exec("CREATE TABLE subscription_provider_links(provider_id TEXT,account_id TEXT);INSERT INTO subscription_provider_links SELECT id,'account' FROM providers WHERE slug='oauth-provider';UPDATE providers SET api_key_enc='' WHERE slug='oauth-provider';INSERT INTO route_aliases VALUES('broken','broken','not-json',1)");
 const exported=transfer.exportConfig(true);
 assert.deepEqual(exported.providers.map(p=>p.slug),['key-provider']);assert.equal(exported.providers[0].api_key,'secret');
 assert.deepEqual(exported.models.map(m=>m.model_id),['key-model']);assert.deepEqual(exported.aliases.map(a=>a.alias),['mixed']);
 assert.deepEqual(exported.aliases[0].targets,[{provider_slug:'key-provider',model_id:'key-model'}]);
 assert.ok(exported.export_warnings?.length);assert.ok(!JSON.stringify(exported.providers).includes('oauth-provider'));
 const target=database();const imported=service(target).importConfig(exported);assert.equal(imported.providers.added,1);assert.equal(imported.aliases.added,1);target.close();sqlite.close();
});
test('import cannot attach new models or alias targets to an existing OAuth provider',()=>{
 const sqlite=database();const transfer=service(sqlite);
 transfer.importConfig({providers:[{slug:'oauth-provider',protocol:'openai',base_url:'https://example.com',api_key:'key'}]});
 sqlite.exec("CREATE TABLE subscription_provider_links(provider_id TEXT,account_id TEXT);INSERT INTO subscription_provider_links SELECT id,'account' FROM providers;");
 const report=transfer.importConfig({models:[{provider_slug:'oauth-provider',model_id:'injected'}],aliases:[{alias:'injected',targets:[{provider_slug:'oauth-provider',model_id:'injected'}]}]});
 assert.equal(report.models.added,0);assert.equal(report.models.skipped,1);assert.equal(report.aliases.added,0);assert.equal(report.aliases.skipped.length,1);sqlite.close();
});
