import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type Database from 'better-sqlite3';

import { createRawCaptureConfigStore } from './config.ts';
import { activeRecordDir, assertArchiveDay, assertRecordId, localDay, rawCaptureRoot } from './paths.ts';
import type {
  RawCaptureArchive,
  RawCaptureEntry,
  RawCapturePage,
  RawCaptureRecord,
  RawCaptureSession,
  RawCaptureStatus,
} from './types.ts';

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS raw_capture_records (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  path TEXT NOT NULL,
  entry_protocol TEXT NOT NULL,
  status INTEGER,
  stream INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  request_bytes INTEGER NOT NULL DEFAULT 0,
  response_bytes INTEGER NOT NULL DEFAULT 0,
  complete INTEGER NOT NULL DEFAULT 0,
  capture_error TEXT,
  location TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_raw_capture_records_day_started
ON raw_capture_records(day DESC, started_at DESC);
CREATE TABLE IF NOT EXISTS raw_capture_archives (
  day TEXT PRIMARY KEY,
  record_count INTEGER NOT NULL,
  raw_bytes INTEGER NOT NULL,
  archive_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT
);
`;

type RawCaptureRecordRow = {
  id: string;
  day: string;
  started_at: number;
  completed_at: number | null;
  path: string;
  entry_protocol: RawCaptureEntry;
  status: number | null;
  stream: number;
  content_type: string | null;
  request_bytes: number;
  response_bytes: number;
  complete: number;
  capture_error: string | null;
  location: 'active' | 'archived';
};

type RawCaptureArchiveRow = {
  day: string;
  record_count: number;
  raw_bytes: number;
  archive_bytes: number;
  created_at: number;
  status: 'ready' | 'error';
  error: string | null;
};

export interface RawCaptureStoreOptions {
  rootDir?: string;
  now?: () => number;
  id?: () => string;
}

export interface BeginRawCaptureRecordInput {
  entryProtocol: RawCaptureEntry;
  path: string;
  requestBody: Uint8Array;
}

export interface RawCaptureListInput {
  page: number;
  pageSize: number;
}

function recordFromRow(row: RawCaptureRecordRow): RawCaptureRecord {
  return {
    id: row.id,
    day: row.day,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    path: row.path,
    entryProtocol: row.entry_protocol,
    status: row.status,
    stream: row.stream === 1,
    contentType: row.content_type,
    requestBytes: row.request_bytes,
    responseBytes: row.response_bytes,
    complete: row.complete === 1,
    captureError: row.capture_error,
    location: row.location,
  };
}

function archiveFromRow(row: RawCaptureArchiveRow): RawCaptureArchive {
  return {
    day: row.day,
    recordCount: row.record_count,
    rawBytes: row.raw_bytes,
    archiveBytes: row.archive_bytes,
    createdAt: row.created_at,
    status: row.status,
    error: row.error,
  };
}

function writeAll(descriptor: number, bytes: Uint8Array): void {
  const buffer = Buffer.from(bytes);
  let offset = 0;
  while (offset < buffer.byteLength) {
    offset += writeSync(descriptor, buffer, offset, buffer.byteLength - offset);
  }
}

function atomicWriteFile(target: string, bytes: Uint8Array): void {
  const directory = dirname(target);
  const temporary = join(directory, `.${basename(target)}.${randomUUID()}.tmp`);
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporary, 'wx', 0o600);
    writeAll(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    renameSync(temporary, target);
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function isEntry(value: unknown): value is RawCaptureEntry {
  return value === 'openai' || value === 'anthropic' || value === 'responses' || value === 'security-lab-anthropic';
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function recordFromMetadata(value: unknown, day: string, id: string): RawCaptureRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.id !== id
    || record.day !== day
    || typeof record.startedAt !== 'number'
    || !Number.isFinite(record.startedAt)
    || typeof record.path !== 'string'
    || !isEntry(record.entryProtocol)
    || !isFiniteNumberOrNull(record.completedAt)
    || !isFiniteNumberOrNull(record.status)
    || typeof record.stream !== 'boolean'
    || (record.contentType !== null && typeof record.contentType !== 'string')
    || typeof record.requestBytes !== 'number'
    || !Number.isFinite(record.requestBytes)
    || typeof record.responseBytes !== 'number'
    || !Number.isFinite(record.responseBytes)
    || typeof record.complete !== 'boolean'
    || (record.captureError !== null && typeof record.captureError !== 'string')
  ) return null;

  return {
    id,
    day,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    path: record.path,
    entryProtocol: record.entryProtocol,
    status: record.status,
    stream: record.stream,
    contentType: record.contentType,
    requestBytes: record.requestBytes,
    responseBytes: record.responseBytes,
    complete: record.complete,
    captureError: record.captureError,
    location: 'active',
  };
}

export function createRawCaptureStore(sqlite: Database.Database, options: RawCaptureStoreOptions = {}) {
  sqlite.exec(CREATE_TABLES_SQL);
  const rootDir = resolve(options.rootDir ?? rawCaptureRoot());
  const now = options.now ?? Date.now;
  const createId = options.id ?? randomUUID;
  const config = createRawCaptureConfigStore(sqlite);
  mkdirSync(join(rootDir, 'active'), { recursive: true });
  mkdirSync(join(rootDir, 'archives'), { recursive: true });
  mkdirSync(join(rootDir, 'tmp'), { recursive: true });

  const insertRecord = sqlite.prepare(`
    INSERT INTO raw_capture_records (
      id, day, started_at, completed_at, path, entry_protocol, status, stream, content_type,
      request_bytes, response_bytes, complete, capture_error, location
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  const updateRecord = sqlite.prepare(`
    UPDATE raw_capture_records
    SET completed_at = ?, status = ?, stream = ?, content_type = ?, request_bytes = ?,
      response_bytes = ?, complete = ?, capture_error = ?, location = ?
    WHERE id = ?
  `);

  const writeRecordIndex = (record: RawCaptureRecord): void => {
    insertRecord.run(
      record.id,
      record.day,
      record.startedAt,
      record.completedAt,
      record.path,
      record.entryProtocol,
      record.status,
      record.stream ? 1 : 0,
      record.contentType,
      record.requestBytes,
      record.responseBytes,
      record.complete ? 1 : 0,
      record.captureError,
      record.location,
    );
  };

  const reconcileActiveRecords = (): void => {
    const activeRoot = join(rootDir, 'active');
    for (const dayEntry of readdirSync(activeRoot, { withFileTypes: true })) {
      if (!dayEntry.isDirectory()) continue;
      try {
        assertArchiveDay(dayEntry.name);
      } catch {
        continue;
      }
      const dayDir = join(activeRoot, dayEntry.name);
      for (const recordEntry of readdirSync(dayDir, { withFileTypes: true })) {
        if (!recordEntry.isDirectory()) continue;
        try {
          assertRecordId(recordEntry.name);
        } catch {
          continue;
        }
        const metadataPath = join(dayDir, recordEntry.name, 'metadata.json');
        if (!existsSync(metadataPath) || !statSync(metadataPath).isFile()) continue;
        try {
          const recovered = recordFromMetadata(
            JSON.parse(readFileSync(metadataPath, 'utf8')),
            dayEntry.name,
            recordEntry.name,
          );
          if (recovered) writeRecordIndex(recovered);
        } catch {
          // Keep unparseable crash-leftover files untouched; a later repair can inspect them.
        }
      }
    }
  };

  reconcileActiveRecords();

  const persistFinalRecord = (record: RawCaptureRecord, recordDir: string): RawCaptureRecord => {
    atomicWriteFile(join(recordDir, 'metadata.json'), Buffer.from(JSON.stringify(record)));
    updateRecord.run(
      record.completedAt,
      record.status,
      record.stream ? 1 : 0,
      record.contentType,
      record.requestBytes,
      record.responseBytes,
      record.complete ? 1 : 0,
      record.captureError,
      record.location,
      record.id,
    );
    return record;
  };

  return {
    async beginRecord(input: BeginRawCaptureRecordInput): Promise<RawCaptureSession> {
      const startedAt = now();
      const day = localDay(startedAt);
      const id = assertRecordId(createId());
      const record: RawCaptureRecord = {
        id,
        day,
        startedAt,
        completedAt: null,
        path: input.path,
        entryProtocol: input.entryProtocol,
        status: null,
        stream: false,
        contentType: null,
        requestBytes: input.requestBody.byteLength,
        responseBytes: 0,
        complete: false,
        captureError: null,
        location: 'active',
      };
      const recordDir = activeRecordDir(rootDir, day, id);
      mkdirSync(dirname(recordDir), { recursive: true });
      mkdirSync(recordDir);
      atomicWriteFile(join(recordDir, 'request.body'), input.requestBody);
      atomicWriteFile(join(recordDir, 'metadata.json'), Buffer.from(JSON.stringify(record)));
      writeRecordIndex(record);

      let responseDescriptor: number | null = openSync(join(recordDir, 'response.body'), 'wx', 0o600);
      let finalized = false;

      const closeResponse = (): void => {
        if (responseDescriptor === null) return;
        const descriptor = responseDescriptor;
        responseDescriptor = null;
        try {
          fsyncSync(descriptor);
        } finally {
          closeSync(descriptor);
        }
      };

      const finish = async (input: {
        status: number;
        stream: boolean;
        contentType: string | null;
        complete: boolean;
        captureError?: string | null;
      }): Promise<RawCaptureRecord> => {
        if (finalized) return record;
        closeResponse();
        finalized = true;
        Object.assign(record, {
          completedAt: now(),
          status: input.status,
          stream: input.stream,
          contentType: input.contentType,
          complete: input.complete,
          captureError: input.captureError ?? null,
        });
        return persistFinalRecord(record, recordDir);
      };

      return {
        record,
        async appendResponse(chunk: Uint8Array): Promise<void> {
          if (finalized || responseDescriptor === null) throw new Error('原始响应记录已结束');
          writeAll(responseDescriptor, chunk);
          record.responseBytes += chunk.byteLength;
        },
        finish,
        async fail(message: string): Promise<RawCaptureRecord> {
          if (finalized) return record;
          closeResponse();
          finalized = true;
          Object.assign(record, {
            completedAt: now(),
            complete: false,
            captureError: message,
          });
          return persistFinalRecord(record, recordDir);
        },
      };
    },

    listRecords(input: RawCaptureListInput): RawCapturePage {
      const page = Math.max(1, Math.trunc(input.page));
      const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize)));
      const total = Number((sqlite.prepare('SELECT COUNT(*) AS count FROM raw_capture_records').get() as { count: number }).count);
      const rows = sqlite.prepare(`
        SELECT * FROM raw_capture_records
        ORDER BY day DESC, started_at DESC, id DESC
        LIMIT ? OFFSET ?
      `).all(pageSize, (page - 1) * pageSize) as RawCaptureRecordRow[];
      return { items: rows.map(recordFromRow), total, page, pageSize };
    },

    getRecord(id: string): RawCaptureRecord | undefined {
      assertRecordId(id);
      const row = sqlite.prepare('SELECT * FROM raw_capture_records WHERE id = ?').get(id) as RawCaptureRecordRow | undefined;
      return row ? recordFromRow(row) : undefined;
    },

    getStatus(): RawCaptureStatus {
      const today = localDay(now());
      const todayRow = sqlite.prepare(`
        SELECT COUNT(*) AS count, COALESCE(SUM(request_bytes + response_bytes), 0) AS bytes
        FROM raw_capture_records WHERE day = ?
      `).get(today) as { count: number; bytes: number };
      const totals = sqlite.prepare(`
        SELECT COUNT(*) AS count, COALESCE(SUM(request_bytes + response_bytes), 0) AS bytes,
          MIN(started_at) AS coverage_start, MAX(COALESCE(completed_at, started_at)) AS coverage_end
        FROM raw_capture_records
      `).get() as {
        count: number;
        bytes: number;
        coverage_start: number | null;
        coverage_end: number | null;
      };
      const archiveCount = Number((sqlite.prepare('SELECT COUNT(*) AS count FROM raw_capture_archives').get() as { count: number }).count);
      const lastArchive = sqlite.prepare(`
        SELECT * FROM raw_capture_archives ORDER BY created_at DESC, day DESC LIMIT 1
      `).get() as RawCaptureArchiveRow | undefined;
      const lastError = sqlite.prepare(`
        SELECT capture_error FROM raw_capture_records
        WHERE capture_error IS NOT NULL
        ORDER BY started_at DESC, id DESC LIMIT 1
      `).get() as { capture_error: string } | undefined;
      return {
        enabled: config.getEnabled(),
        rootDir,
        today,
        todayRecords: Number(todayRow.count),
        todayBytes: Number(todayRow.bytes),
        totalRecords: Number(totals.count),
        totalBytes: Number(totals.bytes),
        archiveCount,
        coverageStart: totals.coverage_start,
        coverageEnd: totals.coverage_end,
        lastArchive: lastArchive ? archiveFromRow(lastArchive) : null,
        lastCaptureError: lastError?.capture_error ?? null,
      };
    },
  };
}

export type RawCaptureStore = ReturnType<typeof createRawCaptureStore>;
