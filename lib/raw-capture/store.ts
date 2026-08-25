import { randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { open as openFile, rename as renameFile, unlink as unlinkFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Database from 'better-sqlite3';

import { createRawCaptureConfigStore } from './config.ts';
import {
  activeRecordDir,
  assertArchiveDay,
  assertManagedDirectory,
  assertManagedRegularFile,
  assertRecordId,
  ensureManagedDirectory,
  localDay,
  managedFilePath,
  rawCaptureRoot,
} from './paths.ts';
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
  openResponseFile?: (path: string) => Promise<RawCaptureResponseFileHandle>;
}

export interface RawCaptureResponseFileHandle {
  write(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ): Promise<{ bytesWritten: number }>;
  sync(): Promise<void>;
  close(): Promise<void>;
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

function writeAllSync(descriptor: number, bytes: Uint8Array): void {
  const buffer = Buffer.from(bytes);
  let offset = 0;
  while (offset < buffer.byteLength) {
    offset += writeSync(descriptor, buffer, offset, buffer.byteLength - offset);
  }
}

function atomicWriteFile(rootDir: string, segments: string[], bytes: Uint8Array): void {
  const target = managedFilePath(rootDir, ...segments);
  const temporarySegments = [
    ...segments.slice(0, -1),
    `.${segments.at(-1)}.${randomUUID()}.tmp`,
  ];
  const temporary = managedFilePath(rootDir, ...temporarySegments);
  let descriptor: number | null = null;
  try {
    descriptor = openSync(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    writeAllSync(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    assertManagedRegularFile(rootDir, ...temporarySegments);
    managedFilePath(rootDir, ...segments);
    renameSync(temporary, target);
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(temporary)) {
      assertManagedRegularFile(rootDir, ...temporarySegments);
      unlinkSync(temporary);
    }
  }
}

async function writeAllAsync(
  handle: RawCaptureResponseFileHandle,
  bytes: Uint8Array,
  onWritten: (bytesWritten: number) => void,
): Promise<void> {
  const buffer = Buffer.from(bytes);
  let offset = 0;
  while (offset < buffer.byteLength) {
    const { bytesWritten } = await handle.write(buffer, offset, buffer.byteLength - offset, null);
    if (!Number.isSafeInteger(bytesWritten) || bytesWritten <= 0 || bytesWritten > buffer.byteLength - offset) {
      throw new Error('异步响应文件写入未取得进展');
    }
    offset += bytesWritten;
    onWritten(bytesWritten);
  }
}

async function atomicWriteFileAsync(rootDir: string, segments: string[], bytes: Uint8Array): Promise<void> {
  const target = managedFilePath(rootDir, ...segments);
  const temporarySegments = [
    ...segments.slice(0, -1),
    `.${segments.at(-1)}.${randomUUID()}.tmp`,
  ];
  const temporary = managedFilePath(rootDir, ...temporarySegments);
  let handle: Awaited<ReturnType<typeof openFile>> | null = null;
  try {
    handle = await openFile(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    const buffer = Buffer.from(bytes);
    while (offset < buffer.byteLength) {
      const { bytesWritten } = await handle.write(buffer, offset, buffer.byteLength - offset, null);
      if (bytesWritten <= 0) throw new Error('异步元数据写入未取得进展');
      offset += bytesWritten;
    }
    await handle.sync();
    await handle.close();
    handle = null;
    assertManagedRegularFile(rootDir, ...temporarySegments);
    managedFilePath(rootDir, ...segments);
    await renameFile(temporary, target);
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    if (existsSync(temporary)) {
      assertManagedRegularFile(rootDir, ...temporarySegments);
      await unlinkFile(temporary);
    }
  }
}

async function defaultOpenResponseFile(path: string): Promise<RawCaptureResponseFileHandle> {
  return openFile(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
}

function readManagedFileSync(rootDir: string, segments: string[]): Buffer {
  const { path } = assertManagedRegularFile(rootDir, ...segments);
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!fstatSync(descriptor).isFile()) throw new Error('原始数据文件不是普通文件');
    return readFileSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

function combineCaptureErrors(...messages: Array<string | null | undefined>): string | null {
  const values = [...new Set(messages.filter((message): message is string => Boolean(message)))];
  return values.length > 0 ? values.join('；') : null;
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
  const openResponseFile = options.openResponseFile ?? defaultOpenResponseFile;
  const config = createRawCaptureConfigStore(sqlite);
  ensureManagedDirectory(rootDir, 'active');
  ensureManagedDirectory(rootDir, 'archives');
  ensureManagedDirectory(rootDir, 'tmp');

  const insertRecord = sqlite.prepare(`
    INSERT INTO raw_capture_records (
      id, day, started_at, completed_at, path, entry_protocol, status, stream, content_type,
      request_bytes, response_bytes, complete, capture_error, location
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  const reconcileRecord = sqlite.prepare(`
    INSERT INTO raw_capture_records (
      id, day, started_at, completed_at, path, entry_protocol, status, stream, content_type,
      request_bytes, response_bytes, complete, capture_error, location
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      day = excluded.day,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      path = excluded.path,
      entry_protocol = excluded.entry_protocol,
      status = excluded.status,
      stream = excluded.stream,
      content_type = excluded.content_type,
      request_bytes = excluded.request_bytes,
      response_bytes = excluded.response_bytes,
      complete = excluded.complete,
      capture_error = excluded.capture_error,
      location = excluded.location
    WHERE raw_capture_records.location != 'archived'
  `);

  const updateRecord = sqlite.prepare(`
    UPDATE raw_capture_records
    SET completed_at = ?, status = ?, stream = ?, content_type = ?, request_bytes = ?,
      response_bytes = ?, complete = ?, capture_error = ?, location = ?
    WHERE id = ?
  `);

  const commitArchiveTransaction = sqlite.transaction((archive: RawCaptureArchive, recordIds: string[]): void => {
    const rows = sqlite.prepare(`
      SELECT * FROM raw_capture_records WHERE day = ? ORDER BY id ASC
    `).all(archive.day) as RawCaptureRecordRow[];
    const indexedIds = rows.map((row) => row.id);
    if (
      rows.length !== recordIds.length
      || indexedIds.some((id, index) => id !== recordIds[index])
      || rows.some((row) => row.complete !== 1)
    ) {
      throw new Error('归档记录索引在提交前发生变化');
    }
    sqlite.prepare(`
      INSERT INTO raw_capture_archives (
        day, record_count, raw_bytes, archive_bytes, created_at, status, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(day) DO UPDATE SET
        record_count = excluded.record_count,
        raw_bytes = excluded.raw_bytes,
        archive_bytes = excluded.archive_bytes,
        created_at = excluded.created_at,
        status = excluded.status,
        error = excluded.error
    `).run(
      archive.day,
      archive.recordCount,
      archive.rawBytes,
      archive.archiveBytes,
      archive.createdAt,
      archive.status,
      archive.error,
    );
    sqlite.prepare(`
      UPDATE raw_capture_records SET location = 'archived' WHERE day = ?
    `).run(archive.day);
  });

  const deleteArchivedDayTransaction = sqlite.transaction((day: string): number => {
    const archive = sqlite.prepare('SELECT day FROM raw_capture_archives WHERE day = ?').get(day);
    if (!archive) return 0;
    sqlite.prepare(`
      DELETE FROM raw_capture_records WHERE day = ? AND location = 'archived'
    `).run(day);
    sqlite.prepare('DELETE FROM raw_capture_archives WHERE day = ?').run(day);
    return 1;
  });

  const writeRecordIndex = (record: RawCaptureRecord, reconcile = false): void => {
    (reconcile ? reconcileRecord : insertRecord).run(
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
    const activeRoot = assertManagedDirectory(rootDir, 'active');
    for (const dayEntry of readdirSync(activeRoot, { withFileTypes: true })) {
      try {
        assertArchiveDay(dayEntry.name);
      } catch {
        continue;
      }
      const dayDir = assertManagedDirectory(rootDir, 'active', dayEntry.name);
      for (const recordEntry of readdirSync(dayDir, { withFileTypes: true })) {
        try {
          assertRecordId(recordEntry.name);
        } catch {
          continue;
        }
        assertManagedDirectory(rootDir, 'active', dayEntry.name, recordEntry.name);
        const archived = sqlite.prepare(`
          SELECT location FROM raw_capture_records WHERE id = ?
        `).get(recordEntry.name) as { location: 'active' | 'archived' } | undefined;
        if (archived?.location === 'archived') continue;
        try {
          const recovered = recordFromMetadata(
            JSON.parse(readManagedFileSync(
              rootDir,
              ['active', dayEntry.name, recordEntry.name, 'metadata.json'],
            ).toString('utf8')),
            dayEntry.name,
            recordEntry.name,
          );
          if (!recovered) continue;

          const recoveryErrors: string[] = [];
          for (const part of ['request', 'response'] as const) {
            const fileName = `${part}.body`;
            try {
              const { stats } = assertManagedRegularFile(
                rootDir,
                'active',
                dayEntry.name,
                recordEntry.name,
                fileName,
              );
              const bytesKey = part === 'request' ? 'requestBytes' : 'responseBytes';
              if (recovered[bytesKey] !== stats.size) {
                recoveryErrors.push(`${fileName} 大小已按磁盘恢复`);
                recovered[bytesKey] = stats.size;
              }
            } catch (error) {
              recoveryErrors.push(`${fileName} 安全检查失败: ${errorMessage(error)}`);
            }
          }
          if (!recovered.complete) recoveryErrors.push('进程异常退出后恢复为未完成记录');
          if (recoveryErrors.length > 0) {
            recovered.complete = false;
            recovered.captureError = combineCaptureErrors(recovered.captureError, ...recoveryErrors);
            atomicWriteFile(
              rootDir,
              ['active', recovered.day, recovered.id, 'metadata.json'],
              Buffer.from(JSON.stringify(recovered)),
            );
          }
          writeRecordIndex(recovered, true);
        } catch {
          // Keep unparseable crash-leftover files untouched; a later repair can inspect them.
        }
      }
    }
  };

  reconcileActiveRecords();

  const persistFinalRecord = async (record: RawCaptureRecord): Promise<RawCaptureRecord> => {
    await atomicWriteFileAsync(
      rootDir,
      ['active', record.day, record.id, 'metadata.json'],
      Buffer.from(JSON.stringify(record)),
    );
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
    rootDir,

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
      ensureManagedDirectory(rootDir, 'active', day);
      mkdirSync(recordDir, { mode: 0o700 });
      assertManagedDirectory(rootDir, 'active', day, id);
      atomicWriteFile(rootDir, ['active', day, id, 'request.body'], input.requestBody);
      atomicWriteFile(rootDir, ['active', day, id, 'metadata.json'], Buffer.from(JSON.stringify(record)));
      writeRecordIndex(record);

      const responsePath = managedFilePath(rootDir, 'active', day, id, 'response.body');
      let responseHandle: RawCaptureResponseFileHandle | null = await openResponseFile(responsePath);
      let acceptingWrites = true;
      let responseIoError: string | null = null;
      let writeQueue = Promise.resolve();
      let finalization: Promise<RawCaptureRecord> | null = null;

      const closeResponse = async (): Promise<string | null> => {
        if (responseHandle === null) return null;
        const handle = responseHandle;
        responseHandle = null;
        const errors: string[] = [];
        try {
          await handle.sync();
        } catch (error) {
          errors.push(errorMessage(error));
        }
        try {
          await handle.close();
        } catch (error) {
          errors.push(errorMessage(error));
        }
        return combineCaptureErrors(...errors);
      };

      const finalize = (input: {
        status: number | null;
        stream: boolean;
        contentType: string | null;
        complete: boolean;
        captureError?: string | null;
      }): Promise<RawCaptureRecord> => {
        if (finalization) return finalization;
        acceptingWrites = false;
        finalization = (async () => {
          await writeQueue;
          const closeError = await closeResponse();
          const captureError = combineCaptureErrors(input.captureError, responseIoError, closeError);
          Object.assign(record, {
            completedAt: now(),
            status: input.status,
            stream: input.stream,
            contentType: input.contentType,
            complete: input.complete && captureError === null,
            captureError,
          });
          return persistFinalRecord(record);
        })();
        return finalization;
      };

      return {
        record,
        async appendResponse(chunk: Uint8Array): Promise<void> {
          if (!acceptingWrites || responseHandle === null) throw new Error('原始响应记录已结束');
          const capturedChunk = Buffer.from(chunk);
          const operation = writeQueue.then(async () => {
            if (responseIoError !== null || responseHandle === null) {
              throw new Error(responseIoError ?? '原始响应记录已结束');
            }
            try {
              await writeAllAsync(responseHandle, capturedChunk, (bytesWritten) => {
                record.responseBytes += bytesWritten;
              });
            } catch (error) {
              responseIoError ??= `响应文件写入失败: ${errorMessage(error)}`;
              throw error;
            }
          });
          writeQueue = operation.catch(() => undefined);
          return operation;
        },
        finish: (input) => finalize(input),
        async fail(message: string): Promise<RawCaptureRecord> {
          return finalize({
            status: record.status,
            stream: record.stream,
            contentType: record.contentType,
            complete: false,
            captureError: message,
          });
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

    listRecordsForDay(day: string): RawCaptureRecord[] {
      assertArchiveDay(day);
      const rows = sqlite.prepare(`
        SELECT * FROM raw_capture_records WHERE day = ? ORDER BY id ASC
      `).all(day) as RawCaptureRecordRow[];
      return rows.map(recordFromRow);
    },

    listArchives(): RawCaptureArchive[] {
      const rows = sqlite.prepare(`
        SELECT * FROM raw_capture_archives ORDER BY day DESC
      `).all() as RawCaptureArchiveRow[];
      return rows.map(archiveFromRow);
    },

    commitArchive(archive: RawCaptureArchive, recordIds: string[]): void {
      assertArchiveDay(archive.day);
      const ids = [...new Set(recordIds.map(assertRecordId))].sort();
      if (ids.length !== recordIds.length || archive.recordCount !== ids.length || archive.status !== 'ready') {
        throw new Error('归档记录索引无效');
      }
      commitArchiveTransaction(archive, ids);
    },

    deleteArchivedDay(day: string): boolean {
      assertArchiveDay(day);
      return deleteArchivedDayTransaction(day) === 1;
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
