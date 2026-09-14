import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrateModelReasoningSchema } from '../lib/db/model-reasoning-migration.ts';

test('reasoning metadata column is added once and existing rows are kept', () => {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE models(id TEXT PRIMARY KEY, model_id TEXT); INSERT INTO models VALUES('m', 'gpt-5.5');");
  migrateModelReasoningSchema(db);
  migrateModelReasoningSchema(db);
  const columns = (db.prepare('PRAGMA table_info(models)').all() as { name: string }[]).map((c) => c.name);
  assert.equal(columns.filter((name) => name === 'reasoning_json').length, 1);
  assert.deepEqual(db.prepare('SELECT id, model_id, reasoning_json FROM models').get(), { id: 'm', model_id: 'gpt-5.5', reasoning_json: null });
  db.close();
});
