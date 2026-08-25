import { randomUUID } from 'node:crypto';
import {
  constants,
  createReadStream,
  createWriteStream,
  existsSync,
  lstatSync,
  openSync,
} from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { PassThrough, type Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import * as tar from 'tar-stream';

import { activeRecordDir, archivePath, assertArchiveDay, assertRecordId, localDay } from './paths.ts';
import type { RawCaptureStore } from './store.ts';
import type { RawCaptureArchive, RawCaptureRecord } from './types.ts';

const ARCHIVE_PARTS = ['metadata.json', 'request.body', 'response.body'] as const;
const STALE_TEMP_AGE_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_TEMP_PATTERN = /^(\d{4}-\d{2}-\d{2})\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.tar\.gz$/i;
const archiveRunsByRoot = new Map<string, Promise<ArchiveRunResult>>();

type ArchivePartName = (typeof ARCHIVE_PARTS)[number];
export type RawCaptureBodyPart = 'request' | 'response';

interface SourceEntry {
  name: string;
  sourcePath: string;
  size: number;
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
  return error instanceof Error ? error.message : String(error);
}

function assertRegularFile(path: string): void {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`归档安全检查失败：${basename(path)} 不是普通文件`);
}

function assertRecordMetadata(bytes: Buffer, record: RawCaptureRecord): void {
  let metadata: unknown;
  try {
    metadata = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`归档元数据无效：${record.id}`);
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`归档元数据无效：${record.id}`);
  }
  const value = metadata as Record<string, unknown>;
  if (
    value.id !== record.id
    || value.day !== record.day
    || value.complete !== true
    || value.requestBytes !== record.requestBytes
    || value.responseBytes !== record.responseBytes
  ) {
    throw new Error(`归档元数据与索引不一致：${record.id}`);
  }
}

async function readMetadataSafely(path: string): Promise<Buffer> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error(`归档安全检查失败：${basename(path)} 不是普通文件`);
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
  const dayDir = join(rootDir, 'active', assertArchiveDay(day));
  const dayInfo = await lstat(dayDir);
  if (!dayInfo.isDirectory() || dayInfo.isSymbolicLink()) throw new Error('归档安全检查失败：活动日期不是普通目录');
  const diskRecordIds = (await readdir(dayDir, { withFileTypes: true }))
    .map((entry) => {
      if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('归档安全检查失败：记录不是普通目录');
      return assertRecordId(entry.name);
    })
    .sort();
  const indexedIds = records.map((record) => record.id).sort();
  if (diskRecordIds.length !== indexedIds.length || diskRecordIds.some((id, index) => id !== indexedIds[index])) {
    throw new Error('活动日期目录与记录索引不一致');
  }

  const entries: SourceEntry[] = [];
  for (const record of [...records].sort((left, right) => left.id.localeCompare(right.id))) {
    if (record.day !== day || record.location !== 'active' || !record.complete) {
      throw new Error(`记录不可归档：${record.id}`);
    }
    const recordDir = activeRecordDir(rootDir, day, record.id);
    const recordInfo = await lstat(recordDir);
    if (!recordInfo.isDirectory() || recordInfo.isSymbolicLink()) throw new Error('归档安全检查失败：记录不是普通目录');
    const fileNames = (await readdir(recordDir)).sort();
    if (fileNames.length !== ARCHIVE_PARTS.length || ARCHIVE_PARTS.some((name, index) => name !== fileNames[index])) {
      throw new Error(`记录文件集合无效：${record.id}`);
    }
    for (const fileName of ARCHIVE_PARTS) {
      const sourcePath = join(recordDir, fileName);
      const fileInfo = await lstat(sourcePath);
      if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
        throw new Error(`归档安全检查失败：${record.id}/${fileName} 不是普通文件`);
      }
      if (fileName === 'request.body' && fileInfo.size !== record.requestBytes) {
        throw new Error(`请求正文大小与索引不一致：${record.id}`);
      }
      if (fileName === 'response.body' && fileInfo.size !== record.responseBytes) {
        throw new Error(`响应正文大小与索引不一致：${record.id}`);
      }
      if (fileName === 'metadata.json') assertRecordMetadata(await readMetadataSafely(sourcePath), record);
      entries.push({ name: `${record.id}/${fileName}`, sourcePath, size: fileInfo.size });
    }
  }
  return entries;
}

async function writeTarGzip({ tempPath, entries }: CreateArchiveInput): Promise<void> {
  const pack = tar.pack();
  const gzip = createGzip();
  const output = createWriteStream(tempPath, { flags: 'wx', mode: 0o600 });
  const archivePipeline = pipeline(pack as unknown as Readable, gzip, output);
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

function expectedEntrySizes(records: RawCaptureRecord[], sourceEntries?: readonly SourceEntry[]): Map<string, number | null> {
  const sourceSizes = new Map(sourceEntries?.map((entry) => [entry.name, entry.size]));
  const expected = new Map<string, number | null>();
  for (const record of records) {
    expected.set(`${record.id}/metadata.json`, sourceSizes.get(`${record.id}/metadata.json`) ?? null);
    expected.set(`${record.id}/request.body`, record.requestBytes);
    expected.set(`${record.id}/response.body`, record.responseBytes);
  }
  return expected;
}

async function verifyArchive(
  filePath: string,
  day: string,
  records: RawCaptureRecord[],
  sourceEntries?: readonly SourceEntry[],
): Promise<void> {
  assertRegularFile(filePath);
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const expected = expectedEntrySizes(records, sourceEntries);
  const seen = new Set<string>();
  const extract = tar.extract();
  let validationError: Error | null = null;

  extract.on('entry', (header, stream, next) => {
    const fail = (error: Error): void => {
      validationError ??= error;
      stream.resume();
      stream.once('end', next);
    };
    if (validationError) return fail(validationError);
    const segments = header.name.split('/');
    const record = segments.length === 2 ? recordsById.get(segments[0]!) : undefined;
    const part = segments[1] as ArchivePartName | undefined;
    if (!record || record.day !== day || !part || !ARCHIVE_PARTS.includes(part) || header.type !== 'file') {
      return fail(new Error(`归档条目无效：${header.name}`));
    }
    if (seen.has(header.name)) return fail(new Error(`归档条目重复：${header.name}`));
    const expectedSize = expected.get(header.name);
    if (expectedSize === undefined || (expectedSize !== null && header.size !== expectedSize)) {
      return fail(new Error(`归档条目大小无效：${header.name}`));
    }
    seen.add(header.name);
    if (part !== 'metadata.json') {
      stream.resume();
      stream.once('end', next);
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    stream.on('data', (chunk: unknown) => {
      const bytes = Buffer.from(chunk as Uint8Array);
      size += bytes.length;
      if (size > 1024 * 1024) validationError ??= new Error(`归档元数据过大：${header.name}`);
      else chunks.push(bytes);
    });
    stream.once('end', () => {
      try {
        if (validationError) throw validationError;
        assertRecordMetadata(Buffer.concat(chunks), record);
      } catch (error) {
        validationError = error instanceof Error ? error : new Error(String(error));
      }
      next();
    });
  });

  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  await pipeline(handle.createReadStream(), createGunzip(), extract as unknown as Writable);
  if (validationError) throw validationError;
  if (seen.size !== expected.size || [...expected.keys()].some((name) => !seen.has(name))) {
    throw new Error('归档条目数量与索引不一致');
  }
}

function archiveRow(day: string, records: RawCaptureRecord[], archiveBytes: number, createdAt: number): RawCaptureArchive {
  return {
    day,
    recordCount: records.length,
    rawBytes: records.reduce((total, record) => total + record.requestBytes + record.responseBytes, 0),
    archiveBytes,
    createdAt,
    status: 'ready',
    error: null,
  };
}

async function removeExactActiveDay(rootDir: string, day: string, recordIds: string[]): Promise<void> {
  const dayDir = join(rootDir, 'active', assertArchiveDay(day));
  if (!existsSync(dayDir)) return;
  const info = await lstat(dayDir);
  if (!info.isDirectory() || info.isSymbolicLink()) return;
  const entries = await readdir(dayDir, { withFileTypes: true });
  const ids = entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort();
  const expected = [...recordIds].sort();
  if (entries.length !== expected.length || ids.some((id, index) => id !== expected[index])) return;
  await rm(dayDir, { recursive: true, force: false });
}

function openPartStream(archiveFile: string, targetName: string, expectedSize: number): Readable {
  assertRegularFile(archiveFile);
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
  const activeRoot = join(rootDir, 'active');
  const archivesRoot = join(rootDir, 'archives');
  const temporaryRoot = join(rootDir, 'tmp');

  const cleanupTemps = async (timestamp: number): Promise<void> => {
    for (const entry of await readdir(temporaryRoot, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink() || !ARCHIVE_TEMP_PATTERN.test(entry.name)) continue;
      const filePath = join(temporaryRoot, entry.name);
      const info = await lstat(filePath);
      if (timestamp - info.mtimeMs > STALE_TEMP_AGE_MS) await unlink(filePath);
    }
  };

  const recoverFinalArchives = async (today: string, timestamp: number, result: ArchiveRunResult): Promise<void> => {
    const indexedByDay = new Map(store.listArchives().map((archive) => [archive.day, archive]));
    const entries = (await readdir(archivesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith('.tar.gz'))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const day = entry.name.slice(0, -'.tar.gz'.length);
      try {
        assertArchiveDay(day);
      } catch {
        continue;
      }
      if (day >= today) continue;
      const records = store.listRecordsForDay(day);
      if (records.length === 0 || records.some((record) => !record.complete)) continue;
      const finalPath = archivePath(rootDir, day);
      const indexedArchive = indexedByDay.get(day);
      if (indexedArchive) {
        const hasRecoveryWork = records.some((record) => record.location === 'active')
          || existsSync(join(activeRoot, day));
        if (!hasRecoveryWork || records.length !== indexedArchive.recordCount) continue;
        try {
          await verifyArchive(finalPath, day, records);
          store.commitArchive(indexedArchive, records.map((record) => record.id));
          await removeExactActiveDay(rootDir, day, records.map((record) => record.id));
        } catch (error) {
          result.errors.push({ day, message: errorMessage(error) });
        }
        continue;
      }
      try {
        await verifyArchive(finalPath, day, records);
        const info = await stat(finalPath);
        store.commitArchive(archiveRow(day, records, info.size, Math.trunc(info.mtimeMs || timestamp)), records.map((record) => record.id));
        await removeExactActiveDay(rootDir, day, records.map((record) => record.id));
        indexedByDay.set(day, archiveRow(day, records, info.size, Math.trunc(info.mtimeMs || timestamp)));
      } catch (error) {
        result.errors.push({ day, message: errorMessage(error) });
      }
    }
  };

  const runArchiveClosedDays = async (timestamp: number): Promise<ArchiveRunResult> => {
    const result: ArchiveRunResult = { archived: [], skipped: [], errors: [] };
    const today = localDay(timestamp);
    await mkdir(activeRoot, { recursive: true });
    await mkdir(archivesRoot, { recursive: true });
    await mkdir(temporaryRoot, { recursive: true });
    await cleanupTemps(timestamp);
    await recoverFinalArchives(today, timestamp, result);

    const indexedArchiveDays = new Set(store.listArchives().map((archive) => archive.day));
    const dayEntries = (await readdir(activeRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const dayEntry of dayEntries) {
      const day = dayEntry.name;
      try {
        assertArchiveDay(day);
      } catch {
        continue;
      }
      if (day >= today) continue;
      const finalPath = archivePath(rootDir, day);
      if (indexedArchiveDays.has(day) || existsSync(finalPath)) {
        result.skipped.push({ day, reason: 'already_archived' });
        continue;
      }
      const records = store.listRecordsForDay(day);
      if (records.length === 0) {
        result.errors.push({ day, message: '活动日期目录没有对应记录索引' });
        continue;
      }
      if (records.some((record) => !record.complete)) {
        result.skipped.push({ day, reason: 'unfinished_records' });
        continue;
      }

      const tempPath = join(temporaryRoot, `${day}.${randomUUID()}.tar.gz`);
      try {
        const sourceEntries = await collectSourceEntries(rootDir, day, records);
        await createArchive({ sourceDir: join(activeRoot, day), tempPath, entries: sourceEntries });
        await verifyArchive(tempPath, day, records, sourceEntries);
        if (existsSync(finalPath)) throw new Error('该日期归档已存在');
        await rename(tempPath, finalPath);
        const info = await stat(finalPath);
        store.commitArchive(archiveRow(day, records, info.size, timestamp), records.map((record) => record.id));
        await removeExactActiveDay(rootDir, day, records.map((record) => record.id));
        indexedArchiveDays.add(day);
        result.archived.push(day);
      } catch (error) {
        if (existsSync(tempPath)) await unlink(tempPath).catch(() => undefined);
        result.errors.push({ day, message: errorMessage(error) });
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

    openArchive(day: string): Readable {
      const validDay = assertArchiveDay(day);
      if (!store.listArchives().some((archive) => archive.day === validDay && archive.status === 'ready')) {
        throw new Error('归档不存在');
      }
      const filePath = archivePath(rootDir, validDay);
      assertRegularFile(filePath);
      const descriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      return createReadStream(filePath, { fd: descriptor, autoClose: true });
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
        archivePath(rootDir, validDay),
        `${id}/${fileName}`,
        part === 'request' ? indexed.requestBytes : indexed.responseBytes,
      );
    },

    async deleteArchive(day: string): Promise<boolean> {
      const validDay = assertArchiveDay(day);
      const archive = store.listArchives().find((item) => item.day === validDay && item.status === 'ready');
      if (!archive) return false;
      const records = store.listRecordsForDay(validDay).filter((record) => record.location === 'archived');
      if (records.length !== archive.recordCount) throw new Error('归档记录索引不一致');
      const finalPath = archivePath(rootDir, validDay);
      await verifyArchive(finalPath, validDay, records);
      const tombstone = join(temporaryRoot, `delete-${validDay}.${randomUUID()}.tar.gz`);
      await rename(finalPath, tombstone);
      try {
        if (!store.deleteArchivedDay(validDay)) throw new Error('归档索引不存在');
      } catch (error) {
        await rename(tombstone, finalPath).catch(() => undefined);
        throw error;
      }
      await unlink(tombstone);
      return true;
    },
  };
}

export type RawCaptureArchiveService = ReturnType<typeof createRawCaptureArchiveService>;
