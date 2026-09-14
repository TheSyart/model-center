import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { encrypt, decrypt } from '../lib/crypto.ts';
import {
  createSubscriptionStore,
  migrateSubscriptionSchema,
} from '../lib/subscriptions/store.ts';
import type {
  Credential,
  Authorization,
  DiscoveredModel,
  ModelDiscovery,
} from '../lib/subscriptions/types.ts';
import { createSubscriptionLifecycle } from '../lib/subscriptions/lifecycle.ts';

process.env.MASTER_KEY = 'subscription-store-test-only';
const credential: Credential = {
  accessToken: 'sensitive-access',
  refreshToken: 'sensitive-refresh',
  expiresAt: 999999,
  accountKey: 'account-a',
  email: 'test@example.test',
};
function setup() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys=ON');
  db.exec(`CREATE TABLE providers(id TEXT PRIMARY KEY,slug TEXT UNIQUE,name TEXT,protocol TEXT,base_url TEXT,api_key_enc TEXT,enabled INTEGER,priority INTEGER,created_at INTEGER,updated_at INTEGER);
  CREATE TABLE provider_endpoints(id TEXT PRIMARY KEY,provider_id TEXT REFERENCES providers(id) ON DELETE CASCADE,protocol TEXT,base_url TEXT,enabled INTEGER,is_default INTEGER,model_catalog_complete INTEGER NOT NULL DEFAULT 0,models_observed_at INTEGER,created_at INTEGER,updated_at INTEGER,UNIQUE(provider_id,protocol));
  CREATE TABLE provider_endpoint_models(endpoint_id TEXT NOT NULL REFERENCES provider_endpoints(id) ON DELETE CASCADE,model_id TEXT NOT NULL,source TEXT NOT NULL,observed_at INTEGER,PRIMARY KEY(endpoint_id,model_id));
  CREATE TABLE models(id TEXT PRIMARY KEY,provider_id TEXT REFERENCES providers(id) ON DELETE CASCADE,model_id TEXT,display_name TEXT,enabled INTEGER,synced INTEGER NOT NULL DEFAULT 0,pricing_source TEXT,UNIQUE(provider_id,model_id));
  CREATE TABLE route_aliases(id TEXT PRIMARY KEY,targets TEXT);`);
  migrateSubscriptionSchema(db);
  let now = 1000;
  const store = createSubscriptionStore(db, {
    encrypt,
    decrypt,
    now: () => now,
  });
  return {
    db,
    store,
    setNow: (v: number) => {
      now = v;
    },
  };
}
test('migration is idempotent and does not rewrite existing providers', () => {
  const { db } = setup();
  db.prepare(
    'INSERT INTO providers(id,slug,api_key_enc,priority) VALUES(?,?,?,?)'
  ).run('old', 'old', 'old-key', 9);
  migrateSubscriptionSchema(db);
  assert.deepEqual(
    db.prepare('SELECT id,api_key_enc,priority FROM providers').get(),
    { id: 'old', api_key_enc: 'old-key', priority: 9 }
  );
  db.close();
});
test('credentials are encrypted and public accounts never expose credential fields', () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', credential);
  const raw = JSON.stringify(
    db.prepare('SELECT * FROM subscription_accounts').all()
  );
  assert.ok(!raw.includes('sensitive-access'));
  assert.ok(!raw.includes('sensitive-refresh'));
  assert.ok(!JSON.stringify(a).includes('credential'));
  assert.ok(!JSON.stringify(a).includes('sensitive'));
  assert.equal(store.getCredential(a.id).accessToken, 'sensitive-access');
  db.close();
});
test('same scoped identity reconnects while different accounts remain distinct', () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', credential);
  const b = store.saveAccount('codex', { ...credential, accessToken: 'new' });
  assert.equal(a.id, b.id);
  assert.notEqual(
    store.saveAccount('codex', { ...credential, accountKey: 'account-b' }).id,
    a.id
  );
  assert.equal(store.list().length, 2);
  db.close();
});
const auth: Authorization = {
  vendor: 'codex',
  kind: 'paste',
  url: 'https://auth.openai.com/authorize',
  state: 'secret-state',
  verifier: 'secret-verifier',
  redirectUri: 'http://localhost:1455/auth/callback',
};
test('OAuth session belongs to a browser, expires and is consumed atomically', () => {
  const { store, db, setNow } = setup();
  const s = store.createSession(auth, 'owner');
  assert.throws(() => store.takeSession(s.id, 'other'), /会话/);
  assert.equal(
    store.takeSession(s.id, 'owner').authorization.verifier,
    'secret-verifier'
  );
  assert.throws(() => store.takeSession(s.id, 'owner'), /会话/);
  const next = store.createSession(auth, 'owner');
  setNow(700000);
  assert.throws(() => store.takeSession(next.id, 'owner'), /会话/);
  db.close();
});
test('refresh lease rejects concurrent work and stale updates after reauthentication', () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', credential);
  const lease = store.acquireRefresh(a.id);
  assert.ok(lease);
  assert.equal(store.acquireRefresh(a.id), null);
  store.saveAccount('codex', { ...credential, accessToken: 'reconnected' });
  assert.equal(
    store.finishRefresh(a.id, lease!, { ...credential, accessToken: 'stale' }),
    false
  );
  assert.equal(store.getCredential(a.id).accessToken, 'reconnected');
  db.close();
});
test('quota error retains previous successful snapshot and marks attempt time', () => {
  const { store, db, setNow } = setup();
  const a = store.saveAccount('codex', credential);
  store.saveQuota(a.id, { checkedAt: 1000, plan: 'plus', windows: [] });
  setNow(2000);
  store.saveQuotaError(a.id, '额度查询暂不可用');
  const view = store.get(a.id)!;
  assert.equal(view.quota?.checkedAt, 1000);
  assert.equal(view.quotaAttemptedAt, 2000);
  assert.equal(view.quotaError, '额度查询暂不可用');
  db.close();
});
test('gateway link adds new provider with explicit models, protects account deletion and aliases', () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', credential);
  const link = store.connectGateway(a.id, ['model-a', 'model-a', 'model-b']);
  assert.ok(link.providerId);
  assert.equal(store.accountForProvider(link.providerId!)?.id, a.id);
  assert.equal(
    (db.prepare('SELECT COUNT(*) n FROM models').get() as { n: number }).n,
    2
  );
  assert.throws(() => store.deleteAccount(a.id), /网关/);
  store.setEnabled(a.id, false);
  assert.equal(
    (
      db
        .prepare('SELECT enabled FROM providers WHERE id=?')
        .get(link.providerId) as { enabled: number }
    ).enabled,
    0
  );
  db.prepare('INSERT INTO route_aliases VALUES(?,?)').run(
    'alias',
    JSON.stringify([{ provider_id: link.providerId, model_id: 'model-a' }])
  );
  assert.throws(() => store.disconnectGateway(a.id), /别名/);
  db.exec('DELETE FROM route_aliases');
  store.disconnectGateway(a.id);
  store.deleteAccount(a.id);
  assert.equal(store.get(a.id), null);
  db.close();
});
test('model input rejects empty and excessive data before writing', () => {
  const { store, db } = setup();
  const a = store.saveAccount('gemini', {
    ...credential,
    projectId: 'project',
  });
  assert.throws(() => store.connectGateway(a.id, []), /模型/);
  assert.throws(() => store.connectGateway(a.id, ['../bad']), /模型/);
  assert.equal(store.get(a.id)?.providerId, null);
  db.close();
});
test('concurrent expired credential readers share refresh and cannot use a disabled account', async () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', { ...credential, expiresAt: 1000 });
  let count = 0;
  const lifecycle = createSubscriptionLifecycle(store, {
    now: () => 2000,
    refresh: async () => {
      count++;
      await new Promise((r) => setTimeout(r, 10));
      return { ...credential, accessToken: 'fresh', expiresAt: 999999 };
    },
    quota: async () => ({ checkedAt: 2000, plan: null, windows: [] }),
  });
  const [x, y] = await Promise.all([
    lifecycle.credential(a.id),
    lifecycle.credential(a.id),
  ]);
  assert.equal(count, 1);
  assert.equal(x.accessToken, 'fresh');
  assert.equal(y.accessToken, 'fresh');
  store.setEnabled(a.id, false);
  await assert.rejects(lifecycle.credential(a.id), /禁用/);
  db.close();
});
test('invalid grant keeps encrypted credential but requires re-login; quota error stays sanitized', async () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', { ...credential, expiresAt: 0 });
  const lifecycle = createSubscriptionLifecycle(store, {
    now: () => 2000,
    refresh: async () => {
      throw Object.assign(new Error('secret-token'), { code: 'needs_reauth' });
    },
    quota: async () => {
      throw Error('secret-token');
    },
  });
  await assert.rejects(lifecycle.credential(a.id), /重新授权/);
  assert.equal(store.get(a.id)?.authStatus, 'needs_reauth');
  assert.equal(store.getCredential(a.id).accessToken, 'sensitive-access');
  await lifecycle.quota(a.id);
  assert.ok(!JSON.stringify(store.list()).includes('secret-token'));
  db.close();
});
test('organization and Google project scopes never overwrite another linked account', () => {
  const { store, db } = setup();
  const g1 = store.saveAccount('gemini', {
    ...credential,
    projectId: 'project-one',
  });
  const g2 = store.saveAccount('gemini', {
    ...credential,
    projectId: 'project-two',
  });
  assert.notEqual(g1.id, g2.id);
  assert.equal(store.getCredential(g1.id).projectId, 'project-one');
  const c1 = store.saveAccount('claude', {
    ...credential,
    organizationId: 'org-one',
  });
  const c2 = store.saveAccount('claude', {
    ...credential,
    organizationId: 'org-two',
  });
  assert.notEqual(c1.id, c2.id);
  assert.throws(
    () =>
      store.saveAccount(
        'claude',
        { ...credential, organizationId: 'org-two' },
        c1.id
      ),
    /不一致/
  );
  assert.equal(store.getCredential(c1.id).accountKey, credential.accountKey);
  db.close();
});
test('refresh leases capture the current credential atomically across a concurrent re-login', async () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', { ...credential, expiresAt: 0 });
  const acquire = store.acquireRefresh;
  store.acquireRefresh = (id) => {
    store.saveAccount('codex', {
      ...credential,
      accessToken: 'relogged',
      refreshToken: 'new-refresh',
    });
    return acquire(id);
  };
  let submitted = '';
  const lifecycle = createSubscriptionLifecycle(store, {
    now: () => 2000,
    refresh: async (_, c) => {
      submitted = c.refreshToken;
      return { ...c, accessToken: 'refreshed' };
    },
    quota: async () => ({ checkedAt: 0, plan: null, windows: [] }),
  });
  await lifecycle.credential(a.id);
  assert.equal(submitted, 'new-refresh');
  assert.equal(store.get(a.id)?.authStatus, 'ready');
  db.close();
});
test('expired refresh results and changed organization are not persisted', async () => {
  for (const override of [
    { expiresAt: 0 },
    { organizationId: 'another-org' },
  ]) {
    const { store, db } = setup();
    const c = { ...credential, expiresAt: 0, organizationId: 'original-org' };
    const a = store.saveAccount('claude', c);
    const lifecycle = createSubscriptionLifecycle(store, {
      now: () => 2000,
      refresh: async () => ({ ...c, expiresAt: 999999, ...override }),
      quota: async () => ({ checkedAt: 0, plan: null, windows: [] }),
    });
    await assert.rejects(lifecycle.credential(a.id));
    assert.equal(store.getCredential(a.id).organizationId, 'original-org');
    assert.equal(store.getCredential(a.id).accessToken, credential.accessToken);
    db.close();
  }
});
test('old quota work cannot overwrite a new login snapshot or error state', async () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', credential);
  let resolve!: (q: {
    checkedAt: number;
    plan: string | null;
    windows: [];
  }) => void;
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  const lifecycle = createSubscriptionLifecycle(store, {
    now: () => 2000,
    refresh: async () => credential,
    quota: async () => {
      started();
      return new Promise((r) => (resolve = r));
    },
  });
  const work = lifecycle.quota(a.id);
  await ready;
  store.saveAccount('codex', { ...credential, accessToken: 'new-login' });
  store.saveQuota(a.id, { checkedAt: 2000, plan: 'new', windows: [] });
  resolve({ checkedAt: 1000, plan: 'old', windows: [] });
  await work;
  assert.equal(store.get(a.id)?.quota?.plan, 'new');
  db.close();
});
test('quota retries one 401 with rotated credential and stores the refreshed generation', async () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', credential);
  const seen: string[] = [];
  const lifecycle = createSubscriptionLifecycle(store, {
    now: () => 2000,
    refresh: async (_, c) => ({ ...c, accessToken: 'rotated' }),
    quota: async (_, c) => {
      seen.push(c.accessToken);
      if (seen.length === 1)
        throw Object.assign(new Error('expired'), { status: 401 });
      return { checkedAt: 2000, plan: 'plus', windows: [] };
    },
  });
  await lifecycle.quota(a.id);
  assert.deepEqual(seen, ['sensitive-access', 'rotated']);
  assert.equal(store.get(a.id)?.quota?.plan, 'plus');
  assert.equal(store.get(a.id)?.quotaError, null);
  db.close();
});
test('an old quota error cannot mark a new login successful snapshot stale', async () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', credential);
  let reject!: (error: Error) => void;
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  const lifecycle = createSubscriptionLifecycle(store, {
    now: () => 2000,
    refresh: async () => credential,
    quota: async () => {
      started();
      return new Promise((_, r) => (reject = r));
    },
  });
  const pending = lifecycle.quota(a.id);
  await ready;
  store.saveAccount('codex', { ...credential, accessToken: 'new-login' });
  store.saveQuota(a.id, { checkedAt: 2000, plan: 'new', windows: [] });
  reject(new Error('secret'));
  await pending;
  assert.equal(store.get(a.id)?.quotaError, null);
  assert.equal(store.get(a.id)?.quota?.plan, 'new');
  db.close();
});

test('Antigravity migration preserves legacy credentials and linked providers', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys=ON');
  db.exec(`CREATE TABLE providers(id TEXT PRIMARY KEY);
CREATE TABLE subscription_accounts (
    id TEXT PRIMARY KEY, vendor TEXT NOT NULL CHECK(vendor IN ('claude','codex','gemini')),
    account_key TEXT NOT NULL, email TEXT, display_name TEXT NOT NULL,
    credential_enc TEXT NOT NULL, expires_at INTEGER NOT NULL, project_id TEXT,
    enabled INTEGER NOT NULL DEFAULT 1, auth_status TEXT NOT NULL DEFAULT 'ready',
    last_error TEXT, version INTEGER NOT NULL DEFAULT 1,
    refresh_lease TEXT, refresh_until INTEGER, retry_after INTEGER,
    quota_json TEXT, quota_error TEXT, quota_attempted_at INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(vendor,account_key));
    CREATE TABLE subscription_provider_links(account_id TEXT UNIQUE NOT NULL REFERENCES subscription_accounts(id) ON DELETE RESTRICT,provider_id TEXT PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE);
    INSERT INTO providers VALUES('provider');
    INSERT INTO subscription_accounts(id,vendor,account_key,display_name,credential_enc,expires_at,created_at,updated_at) VALUES('legacy','gemini','same-google','legacy','ciphertext',999,1,1);
    INSERT INTO subscription_provider_links VALUES('legacy','provider');`);
  migrateSubscriptionSchema(db);
  migrateSubscriptionSchema(db);
  db.exec(
    `INSERT INTO subscription_accounts(id,vendor,account_key,display_name,credential_enc,expires_at,created_at,updated_at) VALUES('new','antigravity','same-google','new','different-ciphertext',999,1,1)`
  );
  assert.deepEqual(
    db
      .prepare(
        "SELECT vendor,credential_enc FROM subscription_accounts WHERE id='legacy'"
      )
      .get(),
    { vendor: 'gemini', credential_enc: 'ciphertext' }
  );
  assert.deepEqual(
    db.prepare('SELECT * FROM subscription_provider_links').get(),
    { account_id: 'legacy', provider_id: 'provider' }
  );
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  db.close();
});

const discovery = (models: DiscoveredModel[]): ModelDiscovery => ({
  models,
  skipped: 0,
  source: 'fixture',
  checkedAt: 1000,
});
const catalog = (db: Database.Database, providerId: string, protocol: string) =>
  (
    db
      .prepare(
        'SELECT m.model_id id FROM provider_endpoint_models m JOIN provider_endpoints e ON e.id=m.endpoint_id WHERE e.provider_id=? AND e.protocol=? ORDER BY m.model_id'
      )
      .all(providerId, protocol) as { id: string }[]
  ).map((row) => row.id);

test('migration adds model sync columns idempotently', () => {
  const { db } = setup();
  migrateSubscriptionSchema(db);
  const columns = (
    db.pragma('table_info(subscription_accounts)') as { name: string }[]
  ).map((column) => column.name);
  for (const column of ['models_error', 'models_synced_at', 'models_attempted_at'])
    assert.equal(columns.filter((name) => name === column).length, 1);
  db.close();
});

test('model sync links the gateway on first run and only adds on later runs', () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', credential);
  const first = store.syncGatewayModels(
    a.id,
    discovery([
      { id: 'gpt-5.5', displayName: 'GPT-5.5', endpoints: ['openai-responses'] },
      { id: 'gpt-5.4', displayName: null, endpoints: ['openai-responses'] },
    ])
  );
  assert.ok(first.account.providerId);
  assert.equal(first.added, 2);
  assert.equal(first.account.modelCount, 2);
  assert.equal(first.account.modelsSyncedAt, 1000);
  db.prepare("UPDATE models SET enabled=0 WHERE model_id='gpt-5.4'").run();
  store.connectGateway(a.id, ['my-manual-model']);
  const second = store.syncGatewayModels(
    a.id,
    discovery([
      { id: 'gpt-5.5', displayName: 'GPT-5.5', endpoints: ['openai-responses'] },
      { id: 'gpt-6', displayName: null, endpoints: ['openai-responses'] },
    ])
  );
  assert.equal(second.account.providerId, first.account.providerId);
  assert.deepEqual(
    { added: second.added, existing: second.existing, missing: second.missing },
    { added: 1, existing: 1, missing: 1 }
  );
  assert.deepEqual(
    db
      .prepare('SELECT model_id,display_name,enabled,synced FROM models ORDER BY model_id')
      .all(),
    [
      { model_id: 'gpt-5.4', display_name: null, enabled: 0, synced: 1 },
      { model_id: 'gpt-5.5', display_name: 'GPT-5.5', enabled: 1, synced: 1 },
      { model_id: 'gpt-6', display_name: null, enabled: 1, synced: 1 },
      { model_id: 'my-manual-model', display_name: null, enabled: 1, synced: 0 },
    ]
  );
  assert.deepEqual(
    db.prepare('SELECT protocol,is_default,model_catalog_complete FROM provider_endpoints').all(),
    [{ protocol: 'openai-responses', is_default: 1, model_catalog_complete: 0 }]
  );
  db.close();
});

test('Copilot sync splits catalogs across chat and responses endpoints and keeps manual models routable', () => {
  const { store, db } = setup();
  const a = store.saveAccount('copilot', credential);
  const legacy = store.connectGateway(a.id, ['manual-model']);
  const result = store.syncGatewayModels(
    a.id,
    discovery([
      { id: 'gpt-5.1', displayName: null, endpoints: ['openai', 'openai-responses'] },
      { id: 'gpt-5.1-codex', displayName: null, endpoints: ['openai-responses'] },
      { id: 'claude-sonnet-4.5', displayName: null, endpoints: ['openai'] },
    ])
  );
  const providerId = result.account.providerId!;
  assert.equal(providerId, legacy.providerId);
  assert.deepEqual(
    db
      .prepare(
        'SELECT protocol,is_default,model_catalog_complete FROM provider_endpoints WHERE provider_id=? ORDER BY protocol'
      )
      .all(providerId),
    [
      { protocol: 'openai', is_default: 1, model_catalog_complete: 1 },
      { protocol: 'openai-responses', is_default: 0, model_catalog_complete: 1 },
    ]
  );
  assert.deepEqual(catalog(db, providerId, 'openai'), [
    'claude-sonnet-4.5',
    'gpt-5.1',
    'manual-model',
  ]);
  assert.deepEqual(catalog(db, providerId, 'openai-responses'), [
    'gpt-5.1',
    'gpt-5.1-codex',
  ]);
  store.connectGateway(a.id, ['added-later']);
  assert.ok(catalog(db, providerId, 'openai').includes('added-later'));
  assert.ok(!catalog(db, providerId, 'openai-responses').includes('added-later'));
  store.syncGatewayModels(
    a.id,
    discovery([
      { id: 'gpt-5.1-codex', displayName: null, endpoints: ['openai-responses'] },
    ])
  );
  assert.deepEqual(catalog(db, providerId, 'openai'), [
    'added-later',
    'claude-sonnet-4.5',
    'gpt-5.1',
    'manual-model',
  ]);
  assert.deepEqual(catalog(db, providerId, 'openai-responses'), ['gpt-5.1-codex']);
  db.close();
});

test('model sync errors are version-guarded, cleared by the next success and invalid lists write nothing', () => {
  const { store, db } = setup();
  const a = store.saveAccount('claude', credential);
  const version = store.getVersion(a.id);
  store.saveAccount('claude', { ...credential, accessToken: 'relogin' });
  assert.equal(store.saveModelsError(a.id, 'stale', version), false);
  assert.equal(store.saveModelsError(a.id, '模型列表拉取失败：上游拒绝请求'), true);
  assert.equal(store.get(a.id)?.modelsError, '模型列表拉取失败：上游拒绝请求');
  assert.throws(
    () =>
      store.syncGatewayModels(
        a.id,
        discovery([{ id: '../escape', displayName: null, endpoints: ['anthropic'] }])
      ),
    /无效/
  );
  assert.equal(store.get(a.id)?.providerId, null);
  store.syncGatewayModels(
    a.id,
    discovery([{ id: 'claude-sonnet-4-6', displayName: null, endpoints: ['anthropic'] }])
  );
  assert.equal(store.get(a.id)?.modelsError, null);
  db.close();
});

test('model sync retries one 401 after refresh and records sanitized failures without undoing the account', async () => {
  const { store, db } = setup();
  const a = store.saveAccount('codex', credential);
  const seen: string[] = [];
  const base = {
    now: () => 2000,
    refresh: async (_: unknown, c: Credential) => ({ ...c, accessToken: 'rotated' }),
    quota: async () => ({ checkedAt: 0, plan: null, windows: [] }),
  };
  const lifecycle = createSubscriptionLifecycle(store, {
    ...base,
    models: async (_, c) => {
      seen.push(c.accessToken);
      if (seen.length === 1)
        throw Object.assign(new Error('expired'), { status: 401 });
      return discovery([
        { id: 'gpt-5.5', displayName: null, endpoints: ['openai-responses'] },
      ]);
    },
  });
  const result = await lifecycle.models(a.id);
  assert.deepEqual(seen, ['sensitive-access', 'rotated']);
  assert.equal(result?.added, 1);
  const failing = createSubscriptionLifecycle(store, {
    ...base,
    models: async () => {
      throw new Error('secret-token leaked');
    },
  });
  assert.equal(await failing.models(a.id), null);
  assert.match(store.get(a.id)!.modelsError!, /模型列表拉取失败/);
  assert.ok(!JSON.stringify(store.list()).includes('secret-token'));
  assert.equal(store.get(a.id)?.authStatus, 'ready');
  assert.equal(store.get(a.id)?.modelCount, 1);
  db.close();
});
