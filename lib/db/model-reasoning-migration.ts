import type Database from 'better-sqlite3';

/** Adds per-model reasoning metadata (JSON, see lib/gateway/reasoning.ts); idempotent. */
export function migrateModelReasoningSchema(sqlite: Database.Database): void {
  const columns = sqlite.prepare('PRAGMA table_info(models)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'reasoning_json')) {
    sqlite.exec('ALTER TABLE models ADD COLUMN reasoning_json TEXT');
  }
}
