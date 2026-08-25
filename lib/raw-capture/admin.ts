import {
  constants,
  createReadStream,
  lstatSync,
  openSync,
} from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type Database from 'better-sqlite3';

import {
  createRawCaptureArchiveService,
  type RawCaptureArchiveService,
  type RawCaptureBodyPart,
} from './archive.ts';
import { createRawCaptureConfigStore } from './config.ts';
import {
  activeRecordDir,
  archivePath,
  assertArchiveDay,
  assertRecordId,
} from './paths.ts';
import { createRawCaptureStore, type RawCaptureStore } from './store.ts';
import type {
  RawCaptureConfig,
  RawCapturePage,
  RawCaptureRecord,
  RawCaptureStatus,
} from './types.ts';

export const RAW_BODY_PREVIEW_BYTES = 262_144;

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;
const INTERNAL_ERROR_MESSAGE = '原始数据服务暂时不可用';

type RawCaptureConfigStore = ReturnType<typeof createRawCaptureConfigStore>;

export interface RawDataAdminDependencies {
  config: Pick<RawCaptureConfigStore, 'getEnabled' | 'setEnabled'>;
  store: Pick<
    RawCaptureStore,
    'rootDir' | 'listRecords' | 'getRecord' | 'getStatus'
  >;
  archive: Pick<
    RawCaptureArchiveService,
    'archiveClosedDays' | 'listArchives' | 'openArchive' | 'openArchivedPart' | 'deleteArchive'
  >;
}

export interface RawDataDashboard {
  config: RawCaptureConfig;
  status: RawCaptureStatus;
}

export interface OpenRawRecordPartResult {
  record: RawCaptureRecord;
  part: RawCaptureBodyPart;
  stream: Readable;
  totalBytes: number;
  servedBytes: number;
  truncated: boolean;
}

export class RawDataValidationError extends Error {
  readonly status = 400;
}

export class RawDataNotFoundError extends Error {
  readonly status = 404;
}

export class RawDataGoneError extends Error {
  readonly status = 410;
}

function positiveInteger(value: string | null, fallback: number): number {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseRawRecordPagination(searchParams: URLSearchParams): { page: number; pageSize: number } {
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isSafeInteger(rawPage) ? Math.max(1, rawPage) : 1;
  return {
    page,
    pageSize: Math.min(100, positiveInteger(searchParams.get('page_size'), 20)),
  };
}

export function assertRecordPart(part: string): RawCaptureBodyPart {
  if (part !== 'request' && part !== 'response') {
    throw new RawDataValidationError('正文类型无效');
  }
  return part;
}

function validRecordId(id: string): string {
  try {
    return assertRecordId(id);
  } catch {
    throw new RawDataValidationError('记录 ID 无效');
  }
}

function validArchiveDay(day: string): string {
  try {
    return assertArchiveDay(day);
  } catch {
    throw new RawDataValidationError('日期无效');
  }
}

function enabledInput(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RawDataValidationError('配置必须且只能包含布尔值 enabled');
  }
  const keys = Object.keys(input);
  const enabled = (input as Record<string, unknown>).enabled;
  if (keys.length !== 1 || keys[0] !== 'enabled' || typeof enabled !== 'boolean') {
    throw new RawDataValidationError('配置必须且只能包含布尔值 enabled');
  }
  return enabled;
}

function assertRegularFile(path: string, expectedBytes: number, missingMessage: string): void {
  try {
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== expectedBytes) {
      throw new RawDataGoneError(missingMessage);
    }
  } catch (error) {
    if (error instanceof RawDataGoneError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new RawDataGoneError(missingMessage);
    throw error;
  }
}

function limitStream(source: Readable, limit: number): Readable {
  if (limit === 0) {
    source.destroy();
    return Readable.from([]);
  }
  return Readable.from((async function* () {
    let remaining = limit;
    for await (const chunk of source) {
      const bytes = Buffer.from(chunk as Uint8Array);
      if (bytes.byteLength <= remaining) {
        yield bytes;
        remaining -= bytes.byteLength;
      } else {
        yield bytes.subarray(0, remaining);
        remaining = 0;
      }
      if (remaining === 0) break;
    }
  })());
}

export async function getRawDataDashboard(services: RawDataAdminDependencies): Promise<RawDataDashboard> {
  const config = { enabled: services.config.getEnabled() };
  const status = services.store.getStatus();
  return {
    config,
    status: status.enabled === config.enabled ? status : { ...status, enabled: config.enabled },
  };
}

export function openRecordPart(
  services: RawDataAdminDependencies,
  id: string,
  part: string,
  previewBytes: number | null = RAW_BODY_PREVIEW_BYTES,
): OpenRawRecordPartResult {
  const validId = validRecordId(id);
  const validPart = assertRecordPart(part);
  const record = services.store.getRecord(validId);
  if (!record) throw new RawDataNotFoundError('原始记录不存在');

  const totalBytes = validPart === 'request' ? record.requestBytes : record.responseBytes;
  const servedBytes = previewBytes === null
    ? totalBytes
    : Math.min(totalBytes, Math.max(0, Math.trunc(previewBytes)));
  let stream: Readable;

  if (record.location === 'active') {
    const fileName = validPart === 'request' ? 'request.body' : 'response.body';
    const path = join(activeRecordDir(services.store.rootDir, record.day, validId), fileName);
    assertRegularFile(path, totalBytes, '原始正文文件已不存在');
    const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    stream = createReadStream(path, {
      fd: descriptor,
      autoClose: true,
      ...(servedBytes < totalBytes && servedBytes > 0 ? { start: 0, end: servedBytes - 1 } : {}),
    });
    if (servedBytes === 0) stream = limitStream(stream, 0);
  } else {
    const archive = services.archive.listArchives().find((item) => item.day === record.day && item.status === 'ready');
    if (!archive) throw new RawDataGoneError('原始正文文件已不存在');
    assertRegularFile(
      archivePath(services.store.rootDir, record.day),
      archive.archiveBytes,
      '原始正文文件已不存在',
    );
    const source = services.archive.openArchivedPart(record, validPart);
    stream = servedBytes < totalBytes ? limitStream(source, servedBytes) : source;
  }

  return {
    record,
    part: validPart,
    stream,
    totalBytes,
    servedBytes,
    truncated: servedBytes < totalBytes,
  };
}

export function createRawDataAdminService(services: RawDataAdminDependencies) {
  return {
    getDashboard(): Promise<RawDataDashboard> {
      return getRawDataDashboard(services);
    },

    async setConfig(input: unknown): Promise<RawDataDashboard> {
      services.config.setEnabled(enabledInput(input));
      return getRawDataDashboard(services);
    },

    listRecords(searchParams: URLSearchParams): RawCapturePage {
      return services.store.listRecords(parseRawRecordPagination(searchParams));
    },

    getRecord(id: string): RawCaptureRecord {
      const record = services.store.getRecord(validRecordId(id));
      if (!record) throw new RawDataNotFoundError('原始记录不存在');
      return record;
    },

    openRecordPart(id: string, part: string, download: boolean): OpenRawRecordPartResult {
      return openRecordPart(services, id, part, download ? null : RAW_BODY_PREVIEW_BYTES);
    },

    async listArchives() {
      await services.archive.archiveClosedDays();
      return services.archive.listArchives();
    },

    runArchiveCheck() {
      return services.archive.archiveClosedDays();
    },

    openArchive(day: string): { day: string; archiveBytes: number; stream: Readable } {
      const validDay = validArchiveDay(day);
      const archive = services.archive.listArchives().find((item) => item.day === validDay && item.status === 'ready');
      if (!archive) throw new RawDataNotFoundError('原始归档不存在');
      assertRegularFile(
        archivePath(services.store.rootDir, validDay),
        archive.archiveBytes,
        '原始归档文件已不存在',
      );
      return { day: validDay, archiveBytes: archive.archiveBytes, stream: services.archive.openArchive(validDay) };
    },

    async deleteArchive(day: string): Promise<boolean> {
      const validDay = validArchiveDay(day);
      const archive = services.archive.listArchives().find((item) => item.day === validDay && item.status === 'ready');
      if (!archive) return false;
      assertRegularFile(
        archivePath(services.store.rootDir, validDay),
        archive.archiveBytes,
        '原始归档文件已不存在',
      );
      return services.archive.deleteArchive(validDay);
    },
  };
}

export type RawDataAdminService = ReturnType<typeof createRawDataAdminService>;
export type RawDataAdminServiceSource = RawDataAdminService | PromiseLike<RawDataAdminService>;

let defaultServicePromise: Promise<RawDataAdminService> | undefined;

export function createDefaultRawDataAdminService(database: Database.Database): RawDataAdminService {
  const store = createRawCaptureStore(database);
  const config = createRawCaptureConfigStore(database);
  const archive = createRawCaptureArchiveService(store);
  return createRawDataAdminService({ config, store, archive });
}

export function getDefaultRawDataAdminService(): Promise<RawDataAdminService> {
  defaultServicePromise ??= import('../db/index.ts')
    .then(({ sqlite }) => createDefaultRawDataAdminService(sqlite))
    .catch((error) => {
      defaultServicePromise = undefined;
      throw error;
    });
  return defaultServicePromise;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function errorResponse(error: unknown): Response {
  if (
    error instanceof RawDataValidationError
    || error instanceof RawDataNotFoundError
    || error instanceof RawDataGoneError
  ) {
    return jsonResponse({ error: error.message }, error.status);
  }
  return jsonResponse({ error: INTERNAL_ERROR_MESSAGE }, 500);
}

function binaryResponse(
  stream: Readable,
  headers: Record<string, string>,
): Response {
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    headers: {
      ...NO_STORE_HEADERS,
      'Content-Type': 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

export async function handleRawDataConfigGet(admin: RawDataAdminServiceSource): Promise<Response> {
  try {
    const service = await admin;
    return jsonResponse(await service.getDashboard());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleRawDataConfigPut(request: Request, admin: RawDataAdminServiceSource): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: '请求体必须是合法 JSON' }, 400);
  }
  try {
    const service = await admin;
    return jsonResponse(await service.setConfig(input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleRawDataRecordsGet(request: Request, admin: RawDataAdminServiceSource): Promise<Response> {
  try {
    const service = await admin;
    return jsonResponse(service.listRecords(new URL(request.url).searchParams));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleRawDataRecordGet(id: string, admin: RawDataAdminServiceSource): Promise<Response> {
  try {
    const validId = validRecordId(id);
    const service = await admin;
    return jsonResponse({ record: service.getRecord(validId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleRawDataRecordPartGet(
  request: Request,
  id: string,
  part: string,
  admin: RawDataAdminServiceSource,
): Promise<Response> {
  try {
    const validId = validRecordId(id);
    const validPart = assertRecordPart(part);
    const download = new URL(request.url).searchParams.get('download') === '1';
    const service = await admin;
    const opened = service.openRecordPart(validId, validPart, download);
    return binaryResponse(opened.stream, {
      'Content-Length': String(opened.servedBytes),
      'X-Raw-Total-Bytes': String(opened.totalBytes),
      'X-Raw-Truncated': String(opened.truncated),
      ...(download
        ? { 'Content-Disposition': `attachment; filename="${validId}.${validPart}.body"` }
        : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleRawDataArchivesGet(admin: RawDataAdminServiceSource): Promise<Response> {
  try {
    const service = await admin;
    return jsonResponse({ archives: await service.listArchives() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleRawDataArchivesPost(admin: RawDataAdminServiceSource): Promise<Response> {
  try {
    const service = await admin;
    return jsonResponse(await service.runArchiveCheck());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleRawDataArchiveGet(day: string, admin: RawDataAdminServiceSource): Promise<Response> {
  try {
    const validDay = validArchiveDay(day);
    const service = await admin;
    const opened = service.openArchive(validDay);
    return binaryResponse(opened.stream, {
      'Content-Type': 'application/gzip',
      'Content-Length': String(opened.archiveBytes),
      'Content-Disposition': `attachment; filename="${validDay}.tar.gz"`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleRawDataArchiveDelete(day: string, admin: RawDataAdminServiceSource): Promise<Response> {
  try {
    const validDay = validArchiveDay(day);
    const service = await admin;
    if (!await service.deleteArchive(validDay)) throw new RawDataNotFoundError('原始归档不存在');
    return jsonResponse({ deleted: true, day: validDay });
  } catch (error) {
    return errorResponse(error);
  }
}
