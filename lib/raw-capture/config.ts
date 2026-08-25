import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

import type { RawCaptureConfig } from './types.ts';

const RAW_CAPTURE_ENABLED_KEY = 'raw_capture_enabled';

function ensureSettingsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export function createRawCaptureConfigStore(database: Database.Database) {
  ensureSettingsTable(database);

  return {
    getEnabled(): boolean {
      const row = database.prepare('SELECT value FROM settings WHERE key = ?').get(RAW_CAPTURE_ENABLED_KEY) as
        | { value: string | null }
        | undefined;
      return row?.value === '1';
    },

    setEnabled(enabled: boolean): RawCaptureConfig {
      database.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(RAW_CAPTURE_ENABLED_KEY, enabled ? '1' : '0');
      return { enabled };
    },
  };
}

function withDefaultDatabase<T>(operation: (database: Database.Database) => T): T {
  const dataDir = process.env.MODEL_CENTER_DB_DIR || join(process.cwd(), 'data');
  mkdirSync(dataDir, { recursive: true });
  const database = new Database(join(dataDir, 'model-center.db'));
  database.pragma('busy_timeout = 5000');
  try {
    return operation(database);
  } finally {
    database.close();
  }
}

export function getRawCaptureEnabled(database?: Database.Database): boolean {
  if (database) return createRawCaptureConfigStore(database).getEnabled();
  return withDefaultDatabase((defaultDatabase) => createRawCaptureConfigStore(defaultDatabase).getEnabled());
}

export function setRawCaptureEnabled(enabled: boolean): RawCaptureConfig;
export function setRawCaptureEnabled(database: Database.Database, enabled: boolean): RawCaptureConfig;
export function setRawCaptureEnabled(
  databaseOrEnabled: Database.Database | boolean,
  maybeEnabled?: boolean,
): RawCaptureConfig {
  if (typeof databaseOrEnabled === 'boolean') {
    return withDefaultDatabase((database) => createRawCaptureConfigStore(database).setEnabled(databaseOrEnabled));
  }
  return createRawCaptureConfigStore(databaseOrEnabled).setEnabled(maybeEnabled === true);
}
