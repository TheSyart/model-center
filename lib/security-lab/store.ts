import type Database from 'better-sqlite3';

import { DEFAULT_SECURITY_LAB_CONFIG, validateSecurityLabConfig } from './config.ts';
import type { RewriteHistoryPage, RewriteHistoryRecord, SecurityLabConfig } from './live-types.ts';

const MAX_SNAPSHOT_CHARS = 64 * 1024;

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS security_lab_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS security_lab_rewrites (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  result TEXT NOT NULL,
  record_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_lab_rewrites_ts
ON security_lab_rewrites(ts DESC);
`;

function capString(value: string): string {
  if (value.length <= MAX_SNAPSHOT_CHARS) return value;
  return `${value.slice(0, MAX_SNAPSHOT_CHARS)}…[truncated]`;
}

function capSnapshots(value: unknown): unknown {
  if (typeof value === 'string') return capString(value);
  if (Array.isArray(value)) return value.map(capSnapshots);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, capSnapshots(item)]));
  }
  return value;
}

export function createSecurityLabStore(sqlite: Database.Database) {
  sqlite.exec(CREATE_TABLES_SQL);

  return {
    getConfig(): SecurityLabConfig {
      const row = sqlite.prepare('SELECT value FROM security_lab_config WHERE id = 1').get() as { value: string } | undefined;
      if (!row) return structuredClone(DEFAULT_SECURITY_LAB_CONFIG);
      try {
        const parsed = JSON.parse(row.value) as SecurityLabConfig;
        return validateSecurityLabConfig(parsed, Number(parsed.updatedAt) || 0);
      } catch {
        return structuredClone(DEFAULT_SECURITY_LAB_CONFIG);
      }
    },

    saveConfig(config: SecurityLabConfig): SecurityLabConfig {
      sqlite.prepare(`
        INSERT INTO security_lab_config (id, value, updated_at) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(JSON.stringify(config), config.updatedAt);
      return config;
    },

    appendHistory(record: RewriteHistoryRecord): RewriteHistoryRecord {
      const sanitized = capSnapshots(record) as RewriteHistoryRecord;
      sqlite.prepare(`
        INSERT INTO security_lab_rewrites (id, request_id, ts, result, record_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(sanitized.id, sanitized.requestId, sanitized.timestamp, sanitized.result, JSON.stringify(sanitized));
      return sanitized;
    },

    listHistory(input: { page: number; pageSize: number }): RewriteHistoryPage {
      const page = Math.max(1, Math.trunc(input.page));
      const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize)));
      const total = Number((sqlite.prepare('SELECT COUNT(*) AS count FROM security_lab_rewrites').get() as { count: number }).count);
      const rows = sqlite.prepare(`
        SELECT record_json FROM security_lab_rewrites
        ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?
      `).all(pageSize, (page - 1) * pageSize) as Array<{ record_json: string }>;
      return {
        items: rows.map((row) => JSON.parse(row.record_json) as RewriteHistoryRecord),
        total,
        page,
        pageSize,
      };
    },

    clearHistory(): number {
      return sqlite.prepare('DELETE FROM security_lab_rewrites').run().changes;
    },
  };
}

export type SecurityLabStore = ReturnType<typeof createSecurityLabStore>;
