import type Database from 'better-sqlite3';

/** Adds per-model capabilities metadata (JSON); idempotent. */
export function migrateModelCapabilitiesSchema(sqlite: Database.Database): void {
  const columns = sqlite.prepare('PRAGMA table_info(models)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'capabilities_json')) {
    sqlite.exec('ALTER TABLE models ADD COLUMN capabilities_json TEXT');
  }
}
