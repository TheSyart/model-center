import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrateModelCapabilitiesSchema } from '../lib/db/capabilities-migration.ts';

test('capabilities column is added once and existing rows are kept', () => {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE models(id TEXT PRIMARY KEY, model_id TEXT); INSERT INTO models VALUES('m', 'qwen3-max');");
  migrateModelCapabilitiesSchema(db);
  migrateModelCapabilitiesSchema(db);
  const columns = (db.prepare('PRAGMA table_info(models)').all() as { name: string }[]).map((c) => c.name);
  assert.equal(columns.filter((name) => name === 'capabilities_json').length, 1);
  assert.deepEqual(db.prepare('SELECT id, model_id, capabilities_json FROM models').get(), {
    id: 'm',
    model_id: 'qwen3-max',
    capabilities_json: null,
  });
  db.close();
});

test('capabilities migration keeps a value written by an earlier run', () => {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE models(id TEXT PRIMARY KEY, model_id TEXT); INSERT INTO models VALUES('m', 'qwen3-max');");
  migrateModelCapabilitiesSchema(db);
  db.prepare('UPDATE models SET capabilities_json = ? WHERE id = ?').run('{"vision":true}', 'm');
  // 开机会再次调用；ALTER 被跳过，已写入的能力资料不能被清掉。
  migrateModelCapabilitiesSchema(db);
  assert.equal(
    (db.prepare('SELECT capabilities_json AS v FROM models WHERE id = ?').get('m') as { v: string }).v,
    '{"vision":true}',
  );
  db.close();
});
