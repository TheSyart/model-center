import { createHash, randomUUID } from 'node:crypto';
import {
  constants,
  createReadStream,
  createWriteStream,
  openSync,
} from 'node:fs';
import {
  open,
  readdir,
  rename,
  rm,
  unlink,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { PassThrough, type Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import * as tar from 'tar-stream';

import {
  assertArchiveDay,
  assertManagedDirectory,
  assertManagedRegularFile,
  assertRecordId,
  localDay,
  managedFilePath,
} from './paths.ts';
import type { RawCaptureStore } from './store.ts';
import type { RawCaptureArchive, RawCaptureEntry, RawCaptureRecord } from './types.ts';
import { RAW_CAPTURE_ENTRY_PATHS, isRawCaptureEntry } from './types.ts';

const ARCHIVE_PARTS = ['metadata.json', 'request.body', 'response.body'] as const;
const METADATA_LIMIT_BYTES = 1024 * 1024;
const STALE_TEMP_AGE_MS = 24 * 60 * 60 * 1000;
const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const ARCHIVE_TEMP_PATTERN = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})\\.(${UUID_SOURCE})\\.tar\\.gz$`, 'i');
const DELETE_TOMBSTONE_PATTERN = new RegExp(`^delete-(\\d{4}-\\d{2}-\\d{2})\\.(${UUID_SOURCE})\\.tar\\.gz$`, 'i');
const FINAL_ARCHIVE_PATTERN = /^(\d{4}-\d{2}-\d{2})\.tar\.gz$/;
const archiveRunsByRoot = new Map<string, Promise<ArchiveRunResult>>();

type ArchivePartName = (typeof ARCHIVE_PARTS)[number];
export type RawCaptureBodyPart = 'request' | 'response';

interface SourceEntry {
  name: string;
  sourcePath: string;
  size: number;
}

interface InspectedArchive {
  records: RawCaptureRecord[];
  entrySizes: Map<string, number>;
  archiveBytes: number;
  createdAt: number;
}

export interface CreateArchiveInput {
  sourceDir: string;
  tempPath: string;
  entries: readonly SourceEntry[];
}

export interface ArchiveRunResult {
  archived: string[];
  skipped: Array<{ day: string; reason: 'unfinished_records' | 'already_archived' }>;
  errors: Array<{ day: string; message: string }>;
}

export interface RawCaptureArchiveServiceOptions {
  rootDir?: string;
  now?: () => number;
  createArchive?: (input: CreateArchiveInput) => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isFiniteStatus(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;
}

function expectedPath(entry: RawCaptureEntry): string {
  return RAW_CAPTURE_ENTRY_PATHS[entry];
}

function parseArchivedMetadata(
  bytes: Buffer,
  expectedDay: string,
  expectedId: string,
  requestBytes: number,
  responseBytes: number,
): RawCaptureRecord {
  let metadata: unknown;
  try {
    metadata = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`归档元数据无效：${expectedId}`);
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`归档元数据无效：${expectedId}`);
  }
  const value = metadata as Record<string, unknown>;
  const expectedKeys = [
    'captureError',
    'complete',
    'completedAt',
    'contentType',
    'day',
    'entryProtocol',
    'id',
    'location',
    'path',
    'requestBytes',
    'responseBytes',
    'startedAt',
    'status',
    'stream',
  ];
  const actualKeys = Object.keys(value).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error(`归档元数据字段集合无效：${expectedId}`);
  }
  if (
    value.id !== expectedId
    || value.day !== expectedDay
    || !isSafeInteger(value.startedAt)
    || !isSafeInteger(value.completedAt)
    || !isRawCaptureEntry(value.entryProtocol)
    || value.path !== expectedPath(value.entryProtocol)
    || !isFiniteStatus(value.status)
    || typeof value.stream !== 'boolean'
    || (value.contentType !== null && typeof value.contentType !== 'string')
    || value.requestBytes !== requestBytes
    || value.responseBytes !== responseBytes
    || value.complete !== true
    || value.captureError !== null
    || (value.location !== 'active' && value.location !== 'archived')
  ) {
    throw new Error(`归档元数据与正文不一致：${expectedId}`);
  }
  return {
    id: expectedId,
    day: expectedDay,
    startedAt: value.startedAt,
    completedAt: value.completedAt,
    path: value.path,
    entryProtocol: value.entryProtocol,
    status: value.status,
    stream: value.stream,
    contentType: value.contentType,
    requestBytes,
    responseBytes,
    complete: true,
    captureError: null,
    location: 'archived',
  };
}

function managedExists(rootDir: string, segments: string[]): boolean {
  try {
    return assertManagedRegularFile(rootDir, ...segments).stats.isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function managedDirectoryExists(rootDir: string, segments: string[]): boolean {
  try {
    assertManagedDirectory(rootDir, ...segments);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function readMetadataSafely(rootDir: string, segments: string[]): Promise<Buffer> {
  const { path } = assertManagedRegularFile(rootDir, ...segments);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error('归档元数据不是普通文件');
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function collectSourceEntries(
  rootDir: string,
  day: string,
  records: RawCaptureRecord[],
): Promise<SourceEntry[]> {
  const dayDir = assertManagedDirectory(rootDir, 'active', assertArchiveDay(day));
  const diskRecordIds = (await readdir(dayDir, { withFileTypes: true })).map((entry) => {
    const id = assertRecordId(entry.name);
    assertManagedDirectory(rootDir, 'active', day, id);
    return id;
  }).sort();
  const indexedIds = records.map((record) => record.id).sort();
  if (diskRecordIds.length !== indexedIds.length || diskRecordIds.some((id, index) => id !== indexedIds[index])) {
    throw new Error('活动日期目录与记录索引不一致');
  }

  const entries: SourceEntry[] = [];
  for (const record of [...records].sort((left, right) => left.id.localeCompare(right.id))) {
    if (record.day !== day || record.location !== 'active' || !record.complete) {
      throw new Error(`记录不可归档：${record.id}`);
    }
    const recordDir = assertManagedDirectory(rootDir, 'active', day, record.id);
    const fileNames = (await readdir(recordDir)).sort();
    if (fileNames.length !== ARCHIVE_PARTS.length || ARCHIVE_PARTS.some((name, index) => name !== fileNames[index])) {
      throw new Error(`记录文件集合无效：${record.id}`);
    }
    for (const fileName of ARCHIVE_PARTS) {
      const segments = ['active', day, record.id, fileName];
      const { path, stats } = assertManagedRegularFile(rootDir, ...segments);
      if (fileName === 'request.body' && stats.size !== record.requestBytes) {
        throw new Error(`请求正文大小与索引不一致：${record.id}`);
      }
      if (fileName === 'response.body' && stats.size !== record.responseBytes) {
        throw new Error(`响应正文大小与索引不一致：${record.id}`);
      }
      if (fileName === 'metadata.json') {
        parseArchivedMetadata(
          await readMetadataSafely(rootDir, segments),
          day,
          record.id,
          record.requestBytes,
          record.responseBytes,
        );
      }
      entries.push({ name: `${record.id}/${fileName}`, sourcePath: path, size: stats.size });
    }
  }
  return entries;
}

async function writeTarGzip({ tempPath, entries }: CreateArchiveInput): Promise<void> {
  const pack = tar.pack();
  const outputDescriptor = openSync(
    tempPath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  const output = createWriteStream(tempPath, { fd: outputDescriptor, autoClose: true });
  const archivePipeline = pipeline(pack as unknown as Readable, createGzip(), output);
  try {
    for (const item of entries) {
      const entry = pack.entry({
        name: item.name,
        size: item.size,
        type: 'file',
        mode: 0o600,
        uid: 0,
        gid: 0,
        mtime: new Date(0),
      });
      const handle = await open(item.sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      await pipeline(handle.createReadStream(), entry as unknown as Writable);
    }
    pack.finalize();
    await archivePipeline;
  } catch (error) {
    pack.destroy(error instanceof Error ? error : new Error(String(error)));
    await archivePipeline.catch(() => undefined);
    throw error;
  }
}

async function inspectArchive(rootDir: string, segments: string[], day: string): Promise<InspectedArchive> {
  const validDay = assertArchiveDay(day);
  const { path, stats } = assertManagedRegularFile(rootDir, ...segments);
  const entrySizes = new Map<string, number>();
  const metadataById = new Map<string, Buffer>();
  const extract = tar.extract();
  let validationError: Error | null = null;

  extract.on('entry', (header, stream, next) => {
    let id: string | null = null;
    let part: ArchivePartName | null = null;
    try {
      const parts = header.name.split('/');
      if (parts.length !== 2) throw new Error(`归档条目路径无效：${header.name}`);
      id = assertRecordId(parts[0]!);
      if (!ARCHIVE_PARTS.includes(parts[1] as ArchivePartName)) {
        throw new Error(`归档条目名称无效：${header.name}`);
      }
      part = parts[1] as ArchivePartName;
      if (header.type !== 'file') throw new Error(`归档条目不是普通文件：${header.name}`);
      if (!Number.isSafeInteger(header.size) || header.size < 0) {
        throw new Error(`归档条目大小无效：${header.name}`);
      }
      if (entrySizes.has(header.name)) throw new Error(`归档条目重复：${header.name}`);
      entrySizes.set(header.name, header.size);
    } catch (error) {
      validationError ??= error instanceof Error ? error : new Error(String(error));
    }

    const chunks: Buffer[] = [];
    let metadataBytes = 0;
    stream.on('data', (chunk: unknown) => {
      if (part !== 'metadata.json' || id === null) return;
      const bytes = Buffer.from(chunk as Uint8Array);
      metadataBytes += bytes.length;
      if (metadataBytes > METADATA_LIMIT_BYTES) {
        validationError ??= new Error(`归档元数据过大：${header.name}`);
      } else {
        chunks.push(bytes);
      }
    });
    stream.once('error', (error) => {
      validationError ??= error;
    });
    stream.once('end', () => {
      if (part === 'metadata.json' && id !== null && metadataBytes <= METADATA_LIMIT_BYTES) {
        metadataById.set(id, Buffer.concat(chunks));
      }
      next();
    });
    stream.resume();
  });

  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  await pipeline(handle.createReadStream(), createGunzip(), extract as unknown as Writable);
  if (validationError) throw validationError;

  const recordIds = [...new Set([...entrySizes.keys()].map((name) => name.split('/')[0]!))].sort();
  if (recordIds.length === 0 || entrySizes.size !== recordIds.length * ARCHIVE_PARTS.length) {
    throw new Error('归档条目集合不完整');
  }
  const records = recordIds.map((id) => {
    const metadata = metadataById.get(id);
    const requestBytes = entrySizes.get(`${id}/request.body`);
    const responseBytes = entrySizes.get(`${id}/response.body`);
    if (!metadata || requestBytes === undefined || responseBytes === undefined) {
      throw new Error(`归档记录条目不完整：${id}`);
    }
    return parseArchivedMetadata(metadata, validDay, id, requestBytes, responseBytes);
  });
  return {
    records,
    entrySizes,
    archiveBytes: stats.size,
    createdAt: Math.trunc(stats.mtimeMs),
  };
}

function sameRecord(left: RawCaptureRecord, right: RawCaptureRecord): boolean {
  return left.id === right.id
    && left.day === right.day
    && left.startedAt === right.startedAt
    && left.completedAt === right.completedAt
    && left.path === right.path
    && left.entryProtocol === right.entryProtocol
    && left.status === right.status
    && left.stream === right.stream
    && left.contentType === right.contentType
    && left.requestBytes === right.requestBytes
    && left.responseBytes === right.responseBytes
    && left.complete === right.complete
    && left.captureError === right.captureError
    && left.location === right.location;
}

async function verifyArchive(
  rootDir: string,
  segments: string[],
  day: string,
  records: RawCaptureRecord[],
  sourceEntries?: readonly SourceEntry[],
): Promise<InspectedArchive> {
  const inspected = await inspectArchive(rootDir, segments, day);
  const expected = [...records]
    .map((record) => ({ ...record, location: 'archived' as const }))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (
    inspected.records.length !== expected.length
    || inspected.records.some((record, index) => !sameRecord(record, expected[index]!))
  ) {
    throw new Error('归档记录与索引不一致');
  }
  if (
    sourceEntries
    && (
      sourceEntries.length !== inspected.entrySizes.size
      || sourceEntries.some((entry) => inspected.entrySizes.get(entry.name) !== entry.size)
    )
  ) {
    throw new Error('归档条目大小与源文件不一致');
  }
  return inspected;
}

function archiveRow(day: string, inspected: InspectedArchive, createdAt = inspected.createdAt): RawCaptureArchive {
  return {
    day,
    recordCount: inspected.records.length,
    rawBytes: inspected.records.reduce(
      (total, record) => total + record.requestBytes + record.responseBytes,
      0,
    ),
    archiveBytes: inspected.archiveBytes,
    createdAt,
    status: 'ready',
    error: null,
  };
}

async function hashManagedFile(rootDir: string, segments: string[]): Promise<string> {
  const { path } = assertManagedRegularFile(rootDir, ...segments);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let position = 0;
  try {
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    return hash.digest('hex');
  } finally {
    await handle.close();
  }
}

async function removeExactActiveDay(rootDir: string, day: string, recordIds: string[]): Promise<void> {
  let dayDir: string;
  try {
    dayDir = assertManagedDirectory(rootDir, 'active', assertArchiveDay(day));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  const ids = (await readdir(dayDir, { withFileTypes: true })).map((entry) => {
    const id = assertRecordId(entry.name);
    assertManagedDirectory(rootDir, 'active', day, id);
    return id;
  }).sort();
  const expected = [...recordIds].sort();
  if (ids.length !== expected.length || ids.some((id, index) => id !== expected[index])) return;
  assertManagedDirectory(rootDir, 'active', day);
  await rm(dayDir, { recursive: true, force: false });
}

function openManagedArchiveStream(rootDir: string, day: string): Readable {
  const segments = ['archives', `${assertArchiveDay(day)}.tar.gz`];
  const { path } = assertManagedRegularFile(rootDir, ...segments);
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  return createReadStream(path, { fd: descriptor, autoClose: true });
}

function openPartStream(rootDir: string, day: string, targetName: string, expectedSize: number): Readable {
  const archiveFile = assertManagedRegularFile(rootDir, 'archives', `${assertArchiveDay(day)}.tar.gz`).path;
  const output = new PassThrough();
  const descriptor = openSync(archiveFile, constants.O_RDONLY | constants.O_NOFOLLOW);
  const source = createReadStream(archiveFile, { fd: descriptor, autoClose: true });
  const gunzip = createGunzip();
  const extract = tar.extract();
  let found = false;
  let settled = false;

  const destroy = (error: Error): void => {
    if (settled) return;
    settled = true;
    source.destroy(error);
    gunzip.destroy(error);
    extract.destroy(error);
    output.destroy(error);
  };

  extract.on('entry', (header, stream, next) => {
    if (header.name !== targetName) {
      stream.resume();
      stream.once('end', next);
      return;
    }
    if (found || header.type !== 'file' || header.size !== expectedSize) {
      stream.resume();
      stream.once('end', () => {
        next();
        destroy(new Error(`归档正文条目无效：${targetName}`));
      });
      return;
    }
    found = true;
    (stream as unknown as Readable).pipe(output, { end: false });
    stream.once('end', next);
    stream.once('error', (error) => destroy(error));
  });

  void pipeline(source, gunzip, extract as unknown as Writable).then(() => {
    if (settled) return;
    settled = true;
    if (!found) output.destroy(new Error(`归档正文不存在：${targetName}`));
    else output.end();
  }, (error) => destroy(error instanceof Error ? error : new Error(String(error))));
  output.once('close', () => {
    if (!settled) destroy(new Error('归档正文读取已取消'));
  });
  return output;
}

export function createRawCaptureArchiveService(
  store: RawCaptureStore,
  options: RawCaptureArchiveServiceOptions = {},
) {
  const rootDir = resolve(options.rootDir ?? store.rootDir);
  if (rootDir !== resolve(store.rootDir)) throw new Error('归档根目录与原始数据存储不一致');
  const now = options.now ?? Date.now;
  const createArchive = options.createArchive ?? writeTarGzip;

  const cleanupCreationTemps = async (timestamp: number): Promise<void> => {
    const temporaryRoot = assertManagedDirectory(rootDir, 'tmp');
    for (const entry of await readdir(temporaryRoot, { withFileTypes: true })) {
      if (!ARCHIVE_TEMP_PATTERN.test(entry.name)) continue;
      const { path, stats } = assertManagedRegularFile(rootDir, 'tmp', entry.name);
      if (timestamp - stats.mtimeMs > STALE_TEMP_AGE_MS) await unlink(path);
    }
  };

  const verifyIndexedArchive = async (
    day: string,
    indexed: RawCaptureArchive,
    segments: string[],
  ): Promise<InspectedArchive> => {
    if (indexed.status !== 'ready' || indexed.error !== null) {
      throw new Error('归档索引不是可恢复的完成状态');
    }
    const indexedRecords = store.listRecordsForDay(day)
      .filter((record) => record.location === 'archived')
      .sort((left, right) => left.id.localeCompare(right.id));
    if (indexedRecords.length !== indexed.recordCount) {
      throw new Error('归档记录索引数量不一致');
    }
    const inspected = await verifyArchive(rootDir, segments, day, indexedRecords);
    const totals = archiveRow(day, inspected, indexed.createdAt);
    if (
      totals.recordCount !== indexed.recordCount
      || totals.rawBytes !== indexed.rawBytes
      || totals.archiveBytes !== indexed.archiveBytes
    ) {
      throw new Error('归档总计与索引不一致');
    }
    return inspected;
  };

  const recoverDeleteTombstones = async (today: string, result: ArchiveRunResult): Promise<Set<string>> => {
    const blockedDays = new Set<string>();
    const blockRecovery = (day: string, message: string): void => {
      blockedDays.add(day);
      result.errors.push({ day, message });
    };
    const temporaryRoot = assertManagedDirectory(rootDir, 'tmp');
    const grouped = new Map<string, string[]>();
    for (const entry of await readdir(temporaryRoot, { withFileTypes: true })) {
      const match = DELETE_TOMBSTONE_PATTERN.exec(entry.name);
      if (!match) continue;
      assertManagedRegularFile(rootDir, 'tmp', entry.name);
      const day = assertArchiveDay(match[1]!);
      grouped.set(day, [...(grouped.get(day) ?? []), entry.name]);
    }

    for (const [day, names] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
      if (day >= today) {
        blockRecovery(day, '删除 tombstone 日期尚未结束');
        continue;
      }
      if (names.length !== 1) {
        blockRecovery(day, '同一日期存在多个删除 tombstone 冲突');
        continue;
      }
      const tombstoneSegments = ['tmp', names[0]!];
      const tombstone = assertManagedRegularFile(rootDir, ...tombstoneSegments).path;
      const finalSegments = ['archives', `${day}.tar.gz`];
      const indexed = store.listArchives().find((archive) => archive.day === day);
      if (!indexed) {
        if (managedExists(rootDir, finalSegments)) {
          blockRecovery(day, '最终归档与无索引删除 tombstone 冲突，已保留两份文件');
        } else {
          await unlink(tombstone);
        }
        continue;
      }
      if (indexed.status !== 'ready' || indexed.error !== null) {
        blockRecovery(day, '错误状态索引与删除 tombstone 冲突');
        continue;
      }
      try {
        const finalExists = managedExists(rootDir, finalSegments);
        if (finalExists) {
          await verifyIndexedArchive(day, indexed, finalSegments);
          await verifyIndexedArchive(day, indexed, tombstoneSegments);
          const [finalHash, tombstoneHash] = await Promise.all([
            hashManagedFile(rootDir, finalSegments),
            hashManagedFile(rootDir, tombstoneSegments),
          ]);
          if (finalHash !== tombstoneHash) {
            throw new Error('最终归档与删除 tombstone 内容不一致');
          }
          await unlink(tombstone);
          continue;
        }

        await verifyIndexedArchive(day, indexed, tombstoneSegments);
        if (managedExists(rootDir, finalSegments)) throw new Error('恢复时最终归档已存在');
        await rename(tombstone, managedFilePath(rootDir, ...finalSegments));
        assertManagedRegularFile(rootDir, ...finalSegments);
      } catch (error) {
        blockRecovery(day, `删除 tombstone 恢复失败：${errorMessage(error)}`);
      }
    }
    return blockedDays;
  };

  const recoverFinalArchives = async (
    today: string,
    result: ArchiveRunResult,
    blockedDays: ReadonlySet<string>,
  ): Promise<void> => {
    const archivesRoot = assertManagedDirectory(rootDir, 'archives');
    const entries = (await readdir(archivesRoot, { withFileTypes: true }))
      .filter((entry) => FINAL_ARCHIVE_PATTERN.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const day = assertArchiveDay(FINAL_ARCHIVE_PATTERN.exec(entry.name)![1]!);
      if (day >= today || blockedDays.has(day)) continue;
      try {
        const indexed = store.listArchives().find((archive) => archive.day === day && archive.status === 'ready');
        const indexedRecords = store.listRecordsForDay(day);
        const indexedArchived = indexedRecords
          .filter((record) => record.location === 'archived')
          .sort((left, right) => left.id.localeCompare(right.id));
        if (indexed && indexedArchived.length === indexed.recordCount) {
          const finalInfo = assertManagedRegularFile(rootDir, 'archives', entry.name).stats;
          if (finalInfo.size !== indexed.archiveBytes) throw new Error('归档文件大小与索引不一致');
          if (managedDirectoryExists(rootDir, ['active', day])) {
            const activeIds = (await readdir(assertManagedDirectory(rootDir, 'active', day), { withFileTypes: true }))
              .map((activeEntry) => {
                const id = assertRecordId(activeEntry.name);
                assertManagedDirectory(rootDir, 'active', day, id);
                return id;
              })
              .sort();
            const archivedIds = indexedArchived.map((record) => record.id);
            const isExactCrashLeftover = activeIds.length === archivedIds.length
              && activeIds.every((id, index) => id === archivedIds[index]);
            if (isExactCrashLeftover) {
              await verifyArchive(rootDir, ['archives', entry.name], day, indexedArchived);
              await removeExactActiveDay(rootDir, day, archivedIds);
            }
          }
          continue;
        }

        const inspected = await inspectArchive(rootDir, ['archives', entry.name], day);
        store.restoreArchive(archiveRow(day, inspected), inspected.records);
        await removeExactActiveDay(rootDir, day, inspected.records.map((record) => record.id));
      } catch (error) {
        const message = errorMessage(error);
        store.recordArchiveFailure(day, message);
        result.errors.push({ day, message });
      }
    }
  };

  const runArchiveClosedDays = async (timestamp: number): Promise<ArchiveRunResult> => {
    const result: ArchiveRunResult = { archived: [], skipped: [], errors: [] };
    const today = localDay(timestamp);
    const activeRoot = assertManagedDirectory(rootDir, 'active');
    assertManagedDirectory(rootDir, 'archives');
    assertManagedDirectory(rootDir, 'tmp');
    await cleanupCreationTemps(timestamp);
    const tombstoneBlockedDays = await recoverDeleteTombstones(today, result);
    await recoverFinalArchives(today, result, tombstoneBlockedDays);

    const indexedArchiveDays = new Set(
      store.listArchives().filter((archive) => archive.status === 'ready').map((archive) => archive.day),
    );
    const dayEntries = (await readdir(activeRoot, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const dayEntry of dayEntries) {
      let day: string;
      try {
        day = assertArchiveDay(dayEntry.name);
      } catch {
        continue;
      }
      try {
        assertManagedDirectory(rootDir, 'active', day);
      } catch (error) {
        result.errors.push({ day, message: errorMessage(error) });
        continue;
      }
      if (day >= today) continue;
      const finalSegments = ['archives', `${day}.tar.gz`];
      if (indexedArchiveDays.has(day) || managedExists(rootDir, finalSegments)) {
        result.skipped.push({ day, reason: 'already_archived' });
        continue;
      }
      const records = store.listRecordsForDay(day);
      if (records.length === 0) {
        const message = '活动日期目录没有对应记录索引';
        store.recordArchiveFailure(day, message, timestamp);
        result.errors.push({ day, message });
        continue;
      }
      if (records.some((record) => !record.complete)) {
        result.skipped.push({ day, reason: 'unfinished_records' });
        continue;
      }

      const tempName = `${day}.${randomUUID()}.tar.gz`;
      const tempSegments = ['tmp', tempName];
      const tempPath = managedFilePath(rootDir, ...tempSegments);
      try {
        const sourceEntries = await collectSourceEntries(rootDir, day, records);
        await createArchive({
          sourceDir: assertManagedDirectory(rootDir, 'active', day),
          tempPath,
          entries: sourceEntries,
        });
        await verifyArchive(rootDir, tempSegments, day, records, sourceEntries);
        if (managedExists(rootDir, finalSegments)) throw new Error('该日期归档已存在');
        assertManagedRegularFile(rootDir, ...tempSegments);
        await rename(tempPath, managedFilePath(rootDir, ...finalSegments));
        const published = await verifyArchive(rootDir, finalSegments, day, records, sourceEntries);
        store.commitArchive(archiveRow(day, published, timestamp), records.map((record) => record.id));
        await removeExactActiveDay(rootDir, day, records.map((record) => record.id));
        indexedArchiveDays.add(day);
        result.archived.push(day);
      } catch (error) {
        if (managedExists(rootDir, tempSegments)) {
          await unlink(assertManagedRegularFile(rootDir, ...tempSegments).path).catch(() => undefined);
        }
        const message = errorMessage(error);
        store.recordArchiveFailure(day, message, timestamp);
        result.errors.push({ day, message });
      }
    }
    return result;
  };

  return {
    archiveClosedDays(timestamp = now()): Promise<ArchiveRunResult> {
      const existing = archiveRunsByRoot.get(rootDir);
      if (existing) return existing;
      const run = runArchiveClosedDays(timestamp).finally(() => {
        if (archiveRunsByRoot.get(rootDir) === run) archiveRunsByRoot.delete(rootDir);
      });
      archiveRunsByRoot.set(rootDir, run);
      return run;
    },

    listArchives(): RawCaptureArchive[] {
      return store.listArchives();
    },

    async openArchive(day: string): Promise<Readable> {
      const validDay = assertArchiveDay(day);
      const archive = store.listArchives().find((item) => item.day === validDay && item.status === 'ready');
      if (!archive) throw new Error('归档不存在');
      const records = store.listRecordsForDay(validDay).filter((record) => record.location === 'archived');
      if (records.length !== archive.recordCount) throw new Error('归档记录索引不一致');
      const inspected = await verifyArchive(rootDir, ['archives', `${validDay}.tar.gz`], validDay, records);
      if (inspected.archiveBytes !== archive.archiveBytes) throw new Error('归档文件大小与索引不一致');
      return openManagedArchiveStream(rootDir, validDay);
    },

    openArchivedPart(record: RawCaptureRecord, part: RawCaptureBodyPart): Readable {
      const id = assertRecordId(record.id);
      const indexed = store.getRecord(id);
      if (!indexed || indexed.day !== record.day || indexed.location !== 'archived') throw new Error('记录未归档');
      const validDay = assertArchiveDay(indexed.day);
      if (!store.listArchives().some((archive) => archive.day === validDay && archive.status === 'ready')) {
        throw new Error('归档不存在');
      }
      const fileName = part === 'request' ? 'request.body' : part === 'response' ? 'response.body' : null;
      if (!fileName) throw new Error('正文类型无效');
      return openPartStream(
        rootDir,
        validDay,
        `${id}/${fileName}`,
        part === 'request' ? indexed.requestBytes : indexed.responseBytes,
      );
    },

    async deleteArchive(day: string): Promise<boolean> {
      const validDay = assertArchiveDay(day);
      if (!store.listArchives().some((item) => item.day === validDay)) return false;
      const finalSegments = ['archives', `${validDay}.tar.gz`];
      const finalPath = assertManagedRegularFile(rootDir, ...finalSegments).path;
      const tombstoneSegments = ['tmp', `delete-${validDay}.${randomUUID()}.tar.gz`];
      const tombstone = managedFilePath(rootDir, ...tombstoneSegments);
      await rename(finalPath, tombstone);
      assertManagedRegularFile(rootDir, ...tombstoneSegments);
      try {
        if (!store.deleteArchivedDay(validDay)) throw new Error('归档索引不存在');
      } catch (error) {
        await rename(tombstone, managedFilePath(rootDir, ...finalSegments)).catch(() => undefined);
        throw error;
      }
      await unlink(tombstone);
      return true;
    },
  };
}

export type RawCaptureArchiveService = ReturnType<typeof createRawCaptureArchiveService>;
