import type Database from 'better-sqlite3';

/** Adds provider-specific model catalog configuration without rewriting existing rows. */
export function migrateProviderCatalogSchema(sqlite: Database.Database): void {
  const columns = sqlite.prepare('PRAGMA table_info(providers)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'workspace_id')) {
    sqlite.exec('ALTER TABLE providers ADD COLUMN workspace_id TEXT');
  }
}
