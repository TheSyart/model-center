import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createProviderAuthPolicy } from '../lib/services/provider-auth.ts';
import { serializeProviderRecord } from '../lib/services/provider-serialization.ts';
function setup() {
  const db = new Database(':memory:');
  db.exec(
    `CREATE TABLE providers(id TEXT PRIMARY KEY,enabled INTEGER,updated_at INTEGER);CREATE TABLE subscription_accounts(id TEXT PRIMARY KEY,enabled INTEGER,updated_at INTEGER);CREATE TABLE subscription_provider_links(provider_id TEXT PRIMARY KEY,account_id TEXT);INSERT INTO providers VALUES('oauth',1,1),('key',1,1);INSERT INTO subscription_accounts VALUES('account',1,1);INSERT INTO subscription_provider_links VALUES('oauth','account');`
  );
  return { db, policy: createProviderAuthPolicy(db) };
}
test('API key decrypt remains available only for ordinary providers', () => {
  const { db, policy } = setup();
  let decrypted = 0;
  const decrypt = (value: string) => {
    decrypted++;
    assert.equal(value, 'encrypted');
    return 'secret';
  };
  assert.equal(
    policy.readApiKey({ id: 'key', apiKeyEnc: 'encrypted' }, decrypt),
    'secret'
  );
  assert.throws(
    () => policy.readApiKey({ id: 'oauth', apiKeyEnc: '' }, decrypt),
    /订阅账号/
  );
  assert.equal(decrypted, 1);
  db.close();
});
test('subscription sensitive edits are rejected while API key edits remain unchanged', () => {
  const { db, policy } = setup();
  for (const field of [
    'api_key',
    'base_url',
    'protocol',
    'endpoints',
    'default_protocol',
    'preset_key',
    'balance_config',
  ]) {
    assert.throws(
      () => policy.validatePatch('oauth', { [field]: 'attempt' }),
      /订阅账号/
    );
    assert.doesNotThrow(() =>
      policy.validatePatch('key', { [field]: 'attempt' })
    );
  }
  assert.doesNotThrow(() =>
    policy.validatePatch('oauth', {
      name: 'renamed',
      remark: 'note',
      priority: 5,
      enabled: false,
    })
  );
  assert.throws(() => policy.validatePatch('oauth', { enabled: 'false' }));
  db.close();
});
test('enabling a subscription provider updates its account in the same transaction', () => {
  const { db, policy } = setup();
  db.transaction(() => {
    db.prepare('UPDATE providers SET enabled=0 WHERE id=?').run('oauth');
    policy.syncEnabled('oauth', false, 2);
  })();
  assert.equal(
    (
      db.prepare('SELECT enabled FROM subscription_accounts').get() as {
        enabled: number;
      }
    ).enabled,
    0
  );
  assert.throws(() =>
    db.transaction(() => {
      db.prepare('UPDATE providers SET enabled=1 WHERE id=?').run('oauth');
      policy.syncEnabled('oauth', true, 3);
      throw new Error('rollback');
    })()
  );
  assert.equal(
    (
      db.prepare('SELECT enabled FROM subscription_accounts').get() as {
        enabled: number;
      }
    ).enabled,
    0
  );
  db.close();
});
test('serialization identifies OAuth auth without exposing credentials; legacy database is supported', () => {
  const { db, policy } = setup();
  const source = {
    id: 'oauth',
    slug: 'oauth',
    name: 'OAuth',
    protocol: 'openai',
    baseUrl: 'https://example.com',
    presetKey: null,
    apiKeyEnc: '',
    enabled: 1,
    priority: 0,
    balanceConfig: null,
    remark: null,
    createdAt: 1,
    updatedAt: 1,
  };
  const view = serializeProviderRecord(source, [], policy.accountId('oauth'));
  assert.equal(view.auth_kind, 'subscription');
  assert.equal(view.subscription_account_id, 'account');
  assert.equal(view.has_key, false);
  assert.equal('apiKeyEnc' in view, false);
  assert.equal(
    serializeProviderRecord(
      { ...source, id: 'key', apiKeyEnc: 'encrypted' },
      []
    ).auth_kind,
    'api_key'
  );
  db.close();
  const legacy = new Database(':memory:');
  assert.equal(createProviderAuthPolicy(legacy).accountId('any'), null);
  legacy.close();
});
