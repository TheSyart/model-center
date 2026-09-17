import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { migrateProviderCatalogSchema } from '../lib/db/provider-catalog-migration.ts';

test('provider catalog migration adds Workspace ID once and preserves existing providers', () => {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE providers (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL
    );
    INSERT INTO providers (id, slug, name) VALUES ('provider-1', 'bailian', 'Bailian');
  `);

  migrateProviderCatalogSchema(sqlite);
  migrateProviderCatalogSchema(sqlite);

  assert.equal(
    (sqlite.prepare('SELECT workspace_id FROM providers WHERE id = ?').get('provider-1') as { workspace_id: string | null }).workspace_id,
    null,
  );
  assert.equal(
    (sqlite.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('providers') WHERE name = 'workspace_id'").get() as { n: number }).n,
    1,
  );
  sqlite.close();
});
