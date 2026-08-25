import type Database from 'better-sqlite3';

import { DEFAULT_SECURITY_LAB_CONFIG, validateSecurityLabConfig } from './config.ts';
import type {
  HistoryToolResult,
  RewriteHistoryPage,
  RewriteHistoryRecord,
  SecurityLabConfig,
} from './live-types.ts';

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
  record_json TEXT NOT NULL,
  injected_tool_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_security_lab_rewrites_ts
ON security_lab_rewrites(ts DESC);
CREATE TABLE IF NOT EXISTS security_lab_tool_results (
  tool_use_id TEXT PRIMARY KEY,
  result_json TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
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

function attachResultToRecord(
  record: RewriteHistoryRecord,
  result: HistoryToolResult,
): RewriteHistoryRecord {
  if (!record.tools?.injected || record.tools.injected.id !== result.toolUseId) return record;
  if (record.tools.injected.result) return record;
  const status = result.isError ? 'failed' : 'completed';
  return {
    ...record,
    steps: [
      ...record.steps,
      {
        code: 'tool_result_received',
        status,
        detail: result.isError ? 'Claude Code 返回工具执行错误' : 'Claude Code 已返回工具执行结果',
        timestamp: result.returnedAt,
      },
    ],
    tools: {
      ...record.tools,
      injected: {
        ...record.tools.injected,
        result: {
          content: capString(result.content),
          isError: result.isError,
          returnedAt: result.returnedAt,
        },
      },
    },
  };
}

function ensureRewriteSchema(sqlite: Database.Database): void {
  const columns = sqlite.prepare('PRAGMA table_info(security_lab_rewrites)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'injected_tool_id')) {
    sqlite.exec('ALTER TABLE security_lab_rewrites ADD COLUMN injected_tool_id TEXT');
    sqlite.exec(`
      UPDATE security_lab_rewrites
      SET injected_tool_id = json_extract(record_json, '$.tools.injected.id')
      WHERE json_extract(record_json, '$.tools.injected.id') IS NOT NULL
    `);
  }
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_security_lab_rewrites_tool ON security_lab_rewrites(injected_tool_id)');
}

export function createSecurityLabStore(sqlite: Database.Database) {
  sqlite.exec(CREATE_TABLES_SQL);
  ensureRewriteSchema(sqlite);

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
      let sanitized = capSnapshots(record) as RewriteHistoryRecord;
      const injectedToolId = sanitized.tools?.injected?.id ?? null;
      if (injectedToolId) {
        const pending = sqlite.prepare(`
          SELECT result_json FROM security_lab_tool_results WHERE tool_use_id = ?
        `).get(injectedToolId) as { result_json: string } | undefined;
        if (pending) {
          sanitized = attachResultToRecord(sanitized, JSON.parse(pending.result_json) as HistoryToolResult);
        }
      }
      sqlite.prepare(`
        INSERT INTO security_lab_rewrites (id, request_id, ts, result, record_json, injected_tool_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        sanitized.id,
        sanitized.requestId,
        sanitized.timestamp,
        sanitized.result,
        JSON.stringify(sanitized),
        injectedToolId,
      );
      return sanitized;
    },

    attachToolResult(result: HistoryToolResult): boolean {
      const sanitized = { ...result, content: capString(result.content) };
      sqlite.prepare(`
        INSERT INTO security_lab_tool_results (tool_use_id, result_json, received_at)
        VALUES (?, ?, ?)
        ON CONFLICT(tool_use_id) DO NOTHING
      `).run(result.toolUseId, JSON.stringify(sanitized), result.returnedAt);

      const row = sqlite.prepare(`
        SELECT id, record_json FROM security_lab_rewrites WHERE injected_tool_id = ? LIMIT 1
      `).get(result.toolUseId) as { id: string; record_json: string } | undefined;
      if (!row) return false;
      const record = JSON.parse(row.record_json) as RewriteHistoryRecord;
      const updated = attachResultToRecord(record, sanitized);
      if (updated !== record) {
        sqlite.prepare('UPDATE security_lab_rewrites SET record_json = ? WHERE id = ?')
          .run(JSON.stringify(updated), row.id);
      }
      return true;
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
      const clear = sqlite.transaction(() => {
        const changes = sqlite.prepare('DELETE FROM security_lab_rewrites').run().changes;
        sqlite.prepare('DELETE FROM security_lab_tool_results').run();
        return changes;
      });
      return clear();
    },
  };
}

export type SecurityLabStore = ReturnType<typeof createSecurityLabStore>;
