import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('@/lib/db/schema');
  const sqlite = new Database(':memory:');
  sqlite.exec(`CREATE TABLE providers(id TEXT PRIMARY KEY,slug TEXT UNIQUE,name TEXT,protocol TEXT,base_url TEXT,preset_key TEXT,api_key_enc TEXT,enabled INTEGER,priority INTEGER,balance_config TEXT,remark TEXT,created_at INTEGER,updated_at INTEGER);
    CREATE TABLE provider_endpoints(id TEXT PRIMARY KEY,provider_id TEXT,protocol TEXT,base_url TEXT,enabled INTEGER,is_default INTEGER,preset_variant_slug TEXT,source_ref TEXT,model_catalog_complete INTEGER,models_observed_at INTEGER,created_at INTEGER,updated_at INTEGER);
    CREATE TABLE subscription_accounts(id TEXT PRIMARY KEY,enabled INTEGER,updated_at INTEGER);
    CREATE TABLE subscription_provider_links(provider_id TEXT PRIMARY KEY,account_id TEXT);
    CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);`);
  return { sqlite, schema, db: drizzle(sqlite, { schema }) };
});
vi.mock('@/lib/services/model', () => ({
  testProviderConnection: vi.fn(async () => ({ ok: true })),
  syncModels: vi.fn(async () => ({ added: 1 })),
}));
vi.mock('@/lib/services/balance', () => ({
  queryBalanceWithSnapshot: vi.fn(async () => ({
    supported: true,
    summary: 'balance',
  })),
}));
vi.mock('@/lib/presets', () => ({ getPreset: () => undefined }));

import { sqlite } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { testProviderConnection, syncModels } from '@/lib/services/model';
import { queryBalanceWithSnapshot } from '@/lib/services/balance';
import { GET as key } from '@/app/api/admin/providers/[id]/key/route';
import { POST as connection } from '@/app/api/admin/providers/[id]/test/route';
import { POST as sync } from '@/app/api/admin/providers/[id]/sync-models/route';
import { GET as balance } from '@/app/api/admin/providers/[id]/balance/route';
import { PATCH, DELETE } from '@/app/api/admin/providers/[id]/route';
import { GET as balances } from '@/app/api/admin/balances/route';
import { GET as providers } from '@/app/api/admin/providers/route';

beforeEach(() => {
  process.env.MASTER_KEY = 'provider-route-tests-only';
  vi.clearAllMocks();
  sqlite.exec(
    'DELETE FROM providers;DELETE FROM subscription_accounts;DELETE FROM subscription_provider_links;'
  );
  const add = sqlite.prepare(
    'INSERT INTO providers VALUES(?,?,?,?,?,NULL,?,1,0,NULL,NULL,1,1)'
  );
  add.run(
    'oauth',
    'oauth',
    'OAuth',
    'openai-responses',
    'https://chatgpt.com/backend-api/codex',
    ''
  );
  add.run(
    'key',
    'key',
    'API key',
    'openai',
    'https://example.com/v1',
    encrypt('api-secret')
  );
  sqlite.exec(
    "INSERT INTO subscription_accounts VALUES('account',1,1);INSERT INTO subscription_provider_links VALUES('oauth','account');"
  );
});
afterAll(() => sqlite.close());
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = () => new NextRequest('http://localhost/api/admin/providers');

describe('legacy provider routes enforce credential ownership', () => {
  it('rejects OAuth key/test/sync/balance/delete before decryption or upstream requests', async () => {
    for (const route of [key, connection, sync, balance, DELETE]) {
      const response = await route(request(), context('oauth'));
      expect(response.status).toBe(409);
      expect((await response.json()).error).toContain('订阅账号');
    }
    expect(testProviderConnection).not.toHaveBeenCalled();
    expect(syncModels).not.toHaveBeenCalled();
    expect(queryBalanceWithSnapshot).not.toHaveBeenCalled();
    expect(
      sqlite.prepare("SELECT id FROM providers WHERE id='oauth'").get()
    ).toBeTruthy();
  });
  it('ordinary API key routes still decrypt and call their original services', async () => {
    expect(await (await key(request(), context('key'))).json()).toEqual({
      api_key: 'api-secret',
    });
    expect((await connection(request(), context('key'))).status).toBe(200);
    expect(testProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'key' }),
      'api-secret'
    );
    expect((await sync(request(), context('key'))).status).toBe(200);
    expect(syncModels).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'key' }),
      'api-secret'
    );
    expect((await balance(request(), context('key'))).status).toBe(200);
    expect(queryBalanceWithSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'key' }),
      'api-secret'
    );
  });
  it('PATCH blocks credential changes but persists enabled state on both account and provider', async () => {
    const patch = (body: unknown) =>
      new NextRequest('http://localhost/api/admin/providers/oauth', {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      });
    expect(
      (await PATCH(patch({ api_key: 'injected' }), context('oauth'))).status
    ).toBe(409);
    const response = await PATCH(patch({ enabled: false }), context('oauth'));
    expect(response.status).toBe(200);
    expect((await response.json()).provider).toMatchObject({
      enabled: false,
      auth_kind: 'subscription',
      subscription_account_id: 'account',
      has_key: false,
    });
    expect(
      sqlite.prepare('SELECT enabled FROM subscription_accounts').get()
    ).toEqual({ enabled: 0 });
    expect(
      sqlite.prepare("SELECT api_key_enc FROM providers WHERE id='oauth'").get()
    ).toEqual({ api_key_enc: '' });
  });
  it('ordinary API key edits and deletion retain the legacy behavior', async () => {
    const req = new NextRequest('http://localhost/api/admin/providers/key', {
      method: 'PATCH',
      body: JSON.stringify({ api_key: 'replacement', enabled: false }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await PATCH(req, context('key'));
    expect(response.status).toBe(200);
    expect((await response.json()).provider).toMatchObject({
      auth_kind: 'api_key',
      enabled: false,
      has_key: true,
    });
    expect(await (await key(request(), context('key'))).json()).toEqual({
      api_key: 'replacement',
    });
    expect(
      sqlite.prepare('SELECT enabled FROM subscription_accounts').get()
    ).toEqual({ enabled: 1 });
    expect((await DELETE(request(), context('key'))).status).toBe(200);
    expect(
      sqlite.prepare("SELECT id FROM providers WHERE id='key'").get()
    ).toBeUndefined();
  });
  it('bulk balances call upstream only for API keys and explain subscription quota ownership', async () => {
    const response = await balances();
    const body = await response.json();
    expect(body.balances).toHaveLength(2);
    expect(
      body.balances.find(
        (v: { provider_id: string }) => v.provider_id === 'oauth'
      ).result.supported
    ).toBe(false);
    expect(queryBalanceWithSnapshot).toHaveBeenCalledTimes(1);
    expect(queryBalanceWithSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'key' }),
      'api-secret'
    );
  });
});

describe('providers page lists API-key providers only', () => {
  it('hides subscription providers when API-key providers are requested and keeps them for shared consumers', async () => {
    const ids = async (url: string) =>
      ((await (await providers(new NextRequest(url))).json()).providers as { id: string }[]).map((p) => p.id).sort();
    expect(await ids('http://localhost/api/admin/providers')).toEqual(['key', 'oauth']);
    expect(await ids('http://localhost/api/admin/providers?auth_kind=api_key')).toEqual(['key']);
  });
});
