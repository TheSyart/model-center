import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import Database from 'better-sqlite3';

import {
  assertRecordPart,
  createRawDataAdminService,
  getRawDataDashboard,
  handleRawDataArchiveDelete,
  handleRawDataArchiveGet,
  handleRawDataArchivesGet,
  handleRawDataArchivesPost,
  handleRawDataConfigGet,
  handleRawDataConfigPut,
  handleRawDataRecordGet,
  handleRawDataRecordPartGet,
  handleRawDataRecordsGet,
  parseRawRecordPagination,
} from '../lib/raw-capture/admin.ts';
import { createRawCaptureArchiveService } from '../lib/raw-capture/archive.ts';
import { createRawCaptureConfigStore } from '../lib/raw-capture/config.ts';
import { createRawCaptureStore, type RawCaptureStore } from '../lib/raw-capture/store.ts';
import type { RawCaptureEntry } from '../lib/raw-capture/types.ts';

const recordA = '11111111-1111-4111-8111-111111111111';
const recordB = '22222222-2222-4222-8222-222222222222';
const recordC = '33333333-3333-4333-8333-333333333333';
const day25 = '2026-08-25';
const day26 = '2026-08-26';

function localNoon(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12, 0, 0, 0).getTime();
}

interface Fixture {
  rootDir: string;
  sqlite: Database.Database;
  store: RawCaptureStore;
  config: ReturnType<typeof createRawCaptureConfigStore>;
  archive: ReturnType<typeof createRawCaptureArchiveService>;
  admin: ReturnType<typeof createRawDataAdminService>;
  complete(input: {
    day: string;
    id: string;
    request: Uint8Array;
    response: Uint8Array;
    entry?: RawCaptureEntry;
    path?: string;
    status?: number;
    stream?: boolean;
    contentType?: string | null;
  }): Promise<void>;
}

function createFixture(t: TestContext): Fixture {
  const rootDir = mkdtempSync(join(tmpdir(), 'model-center-raw-admin-'));
  const sqlite = new Database(':memory:');
  let timestamp = localNoon(day26);
  let nextId = recordA;
  const store = createRawCaptureStore(sqlite, {
    rootDir,
    now: () => timestamp,
    id: () => nextId,
  });
  const config = createRawCaptureConfigStore(sqlite);
  const archive = createRawCaptureArchiveService(store, {
    rootDir,
    now: () => localNoon(day26),
  });
  const admin = createRawDataAdminService({ config, store, archive });

  t.after(() => {
    sqlite.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  return {
    rootDir,
    sqlite,
    store,
    config,
    archive,
    admin,
    async complete(input) {
      timestamp = localNoon(input.day);
      nextId = input.id;
      const session = await store.beginRecord({
        entryProtocol: input.entry ?? 'anthropic',
        path: input.path ?? '/v1/messages',
        requestBody: input.request,
      });
      await session.appendResponse(input.response);
      await session.finish({
        status: input.status ?? 200,
        stream: input.stream ?? false,
        contentType: input.contentType ?? 'application/octet-stream',
        complete: true,
      });
    },
  };
}

async function json(response: Response): Promise<unknown> {
  return response.json();
}

test('clamps record pagination to page 1 and page size 100', () => {
  assert.deepEqual(parseRawRecordPagination(new URLSearchParams('page=-2&page_size=500')), {
    page: 1,
    pageSize: 100,
  });
  assert.deepEqual(parseRawRecordPagination(new URLSearchParams('page=3&page_size=25')), {
    page: 3,
    pageSize: 25,
  });
  assert.deepEqual(parseRawRecordPagination(new URLSearchParams('page=oops&page_size=0')), {
    page: 1,
    pageSize: 20,
  });
});

test('allows only request or response record parts', () => {
  assert.equal(assertRecordPart('request'), 'request');
  assert.equal(assertRecordPart('response'), 'response');
  assert.throws(() => assertRecordPart('../../metadata'), /正文类型/);
});

test('dashboard statistics use metadata even when active body files are unavailable', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete({ day: day25, id: recordA, request: Buffer.from('old-request'), response: Buffer.from('old-response') });
  await fixture.archive.archiveClosedDays();
  await fixture.complete({ day: day26, id: recordB, request: Buffer.from('today-a'), response: Buffer.from('answer-a') });
  await fixture.complete({ day: day26, id: recordC, request: Buffer.from('today-b'), response: Buffer.from('answer-b') });
  unlinkSync(join(fixture.rootDir, 'active', day26, recordB, 'request.body'));
  unlinkSync(join(fixture.rootDir, 'active', day26, recordC, 'response.body'));

  const dashboard = await getRawDataDashboard({
    config: fixture.config,
    store: fixture.store,
    archive: fixture.archive,
  });

  assert.equal(dashboard.config.enabled, false);
  assert.equal(dashboard.status.rootDir, fixture.rootDir);
  assert.equal(dashboard.status.today, day26);
  assert.equal(dashboard.status.todayRecords, 2);
  assert.equal(dashboard.status.todayBytes, 30);
  assert.equal(dashboard.status.totalRecords, 3);
  assert.equal(dashboard.status.totalBytes, 53);
  assert.equal(dashboard.status.archiveCount, 1);
  assert.equal(dashboard.status.lastArchive?.day, day25);
});

test('config GET defaults off and PUT accepts exactly an object with boolean enabled', async (t) => {
  const fixture = createFixture(t);
  const initial = await handleRawDataConfigGet(fixture.admin);
  assert.equal(initial.status, 200);
  assert.equal(initial.headers.get('cache-control'), 'no-store');
  assert.equal((await json(initial) as { config: { enabled: boolean } }).config.enabled, false);

  const enabled = await handleRawDataConfigPut(
    new Request('http://localhost/api/admin/raw-data/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{  "enabled": true }',
    }),
    fixture.admin,
  );
  assert.equal(enabled.status, 200);
  assert.equal((await json(enabled) as { config: { enabled: boolean } }).config.enabled, true);
  assert.equal(fixture.config.getEnabled(), true);

  for (const body of ['null', '[]', '{}', '{"enabled":1}', '{"enabled":true,"extra":false}']) {
    const invalid = await handleRawDataConfigPut(new Request('http://localhost', { method: 'PUT', body }), fixture.admin);
    assert.equal(invalid.status, 400, body);
  }
  const malformed = await handleRawDataConfigPut(new Request('http://localhost', { method: 'PUT', body: '{' }), fixture.admin);
  assert.equal(malformed.status, 400);
  assert.deepEqual(await json(malformed), { error: '请求体必须是合法 JSON' });
});

test('records endpoint returns the clamped metadata page and record detail', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete({ day: day26, id: recordA, request: Buffer.from('request'), response: Buffer.from('response') });

  const page = await handleRawDataRecordsGet(
    new Request('http://localhost/api/admin/raw-data/records?page=-1&page_size=500'),
    fixture.admin,
  );
  assert.equal(page.status, 200);
  assert.deepEqual(await json(page), {
    items: [fixture.store.getRecord(recordA)],
    total: 1,
    page: 1,
    pageSize: 100,
  });

  const detail = await handleRawDataRecordGet(recordA, fixture.admin);
  assert.equal(detail.status, 200);
  assert.deepEqual(await json(detail), { record: fixture.store.getRecord(recordA) });
});

test('record lookup validates IDs before service calls and maps missing records to 404', async (t) => {
  const fixture = createFixture(t);
  let calls = 0;
  const guarded = {
    ...fixture.admin,
    getRecord() {
      calls += 1;
      throw new Error('must not be reached');
    },
  };

  const invalid = await handleRawDataRecordGet('../secret', guarded);
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);

  const missing = await handleRawDataRecordGet(recordA, fixture.admin);
  assert.equal(missing.status, 404);
  assert.deepEqual(await json(missing), { error: '原始记录不存在' });
});

test('body preview returns exactly 262144 unchanged bytes and complete download returns every byte', async (t) => {
  const fixture = createFixture(t);
  const request = Buffer.alloc(262145);
  for (let index = 0; index < request.length; index += 1) request[index] = index % 251;
  const response = Buffer.from([0, 255, 123, 32, 10, 228, 184, 150, 231, 149, 140]);
  await fixture.complete({ day: day26, id: recordA, request, response });

  const preview = await handleRawDataRecordPartGet(
    new Request(`http://localhost/api/admin/raw-data/records/${recordA}/request`),
    recordA,
    'request',
    fixture.admin,
  );
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('cache-control'), 'no-store');
  assert.equal(preview.headers.get('x-raw-total-bytes'), '262145');
  assert.equal(preview.headers.get('x-raw-truncated'), 'true');
  assert.equal(preview.headers.get('content-disposition'), null);
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), request.subarray(0, 262144));

  const download = await handleRawDataRecordPartGet(
    new Request(`http://localhost/api/admin/raw-data/records/${recordA}/request?download=1`),
    recordA,
    'request',
    fixture.admin,
  );
  assert.equal(download.headers.get('x-raw-total-bytes'), '262145');
  assert.equal(download.headers.get('x-raw-truncated'), 'false');
  assert.equal(download.headers.get('content-disposition'), `attachment; filename="${recordA}.request.body"`);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), request);

  const responseDownload = await handleRawDataRecordPartGet(
    new Request(`http://localhost/api/admin/raw-data/records/${recordA}/response?download=1`),
    recordA,
    'response',
    fixture.admin,
  );
  assert.deepEqual(Buffer.from(await responseDownload.arrayBuffer()), response);
});

test('body endpoint rejects invalid parts before opening files and reports missing indexed files as 410', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete({ day: day26, id: recordA, request: Buffer.from('request'), response: Buffer.from('response') });
  let calls = 0;
  const guarded = {
    ...fixture.admin,
    openRecordPart() {
      calls += 1;
      throw new Error('must not be reached');
    },
  };

  const invalid = await handleRawDataRecordPartGet(
    new Request('http://localhost'),
    recordA,
    '../../metadata',
    guarded,
  );
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);

  unlinkSync(join(fixture.rootDir, 'active', day26, recordA, 'response.body'));
  const gone = await handleRawDataRecordPartGet(
    new Request('http://localhost'),
    recordA,
    'response',
    fixture.admin,
  );
  assert.equal(gone.status, 410);
  assert.deepEqual(await json(gone), { error: '原始正文文件已不存在' });
});

test('archived record parts remain exact and missing archive files return 410', async (t) => {
  const fixture = createFixture(t);
  const request = Buffer.from('{  "prompt": "原样" }\n');
  await fixture.complete({ day: day25, id: recordA, request, response: Buffer.from('answer') });
  await fixture.archive.archiveClosedDays();

  const body = await handleRawDataRecordPartGet(
    new Request(`http://localhost/api/admin/raw-data/records/${recordA}/request?download=1`),
    recordA,
    'request',
    fixture.admin,
  );
  assert.deepEqual(Buffer.from(await body.arrayBuffer()), request);

  unlinkSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`));
  const gone = await handleRawDataRecordPartGet(
    new Request(`http://localhost/api/admin/raw-data/records/${recordA}/request`),
    recordA,
    'request',
    fixture.admin,
  );
  assert.equal(gone.status, 410);
});

test('archive collection GET performs the lazy check and POST returns the archive run result', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete({ day: day25, id: recordA, request: Buffer.from('request'), response: Buffer.from('response') });

  const list = await handleRawDataArchivesGet(fixture.admin);
  assert.equal(list.status, 200);
  const listed = await json(list) as { archives: Array<{ day: string }> };
  assert.equal(listed.archives[0]?.day, day25);

  const run = await handleRawDataArchivesPost(fixture.admin);
  assert.equal(run.status, 200);
  assert.deepEqual(await json(run), { archived: [], skipped: [], errors: [] });
});

test('archive download streams the complete tar.gz and DELETE removes only one validated day', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete({ day: day25, id: recordA, request: Buffer.from('request'), response: Buffer.from('response') });
  await fixture.archive.archiveClosedDays();
  const archivePath = join(fixture.rootDir, 'archives', `${day25}.tar.gz`);
  assert.equal(existsSync(archivePath), true);

  const download = await handleRawDataArchiveGet(day25, fixture.admin);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.equal(download.headers.get('content-type'), 'application/gzip');
  assert.equal(download.headers.get('content-disposition'), `attachment; filename="${day25}.tar.gz"`);
  assert.ok((await download.arrayBuffer()).byteLength > 0);

  const invalid = await handleRawDataArchiveDelete('../2026-08-25', fixture.admin);
  assert.equal(invalid.status, 400);
  assert.equal(existsSync(archivePath), true);

  const deleted = await handleRawDataArchiveDelete(day25, fixture.admin);
  assert.equal(deleted.status, 200);
  assert.deepEqual(await json(deleted), { deleted: true, day: day25 });
  assert.equal(existsSync(archivePath), false);

  const missing = await handleRawDataArchiveGet(day25, fixture.admin);
  assert.equal(missing.status, 404);
});

test('indexed archive with a missing tarball returns 410', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete({ day: day25, id: recordA, request: Buffer.from('request'), response: Buffer.from('response') });
  await fixture.archive.archiveClosedDays();
  unlinkSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`));

  const response = await handleRawDataArchiveGet(day25, fixture.admin);
  assert.equal(response.status, 410);
  assert.deepEqual(await json(response), { error: '原始归档文件已不存在' });
});

test('deleting an indexed archive with a missing tarball returns 410', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete({ day: day25, id: recordA, request: Buffer.from('request'), response: Buffer.from('response') });
  await fixture.archive.archiveClosedDays();
  unlinkSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`));

  const response = await handleRawDataArchiveDelete(day25, fixture.admin);
  assert.equal(response.status, 410);
  assert.deepEqual(await json(response), { error: '原始归档文件已不存在' });
});

test('route helpers resolve the lazy admin service inside stable error handling', async (t) => {
  const fixture = createFixture(t);
  const response = await handleRawDataConfigGet(Promise.resolve(fixture.admin));
  assert.equal(response.status, 200);
  assert.equal((await json(response) as { config: { enabled: boolean } }).config.enabled, false);
});

test('unexpected admin failures return one stable JSON error without leaking details', async () => {
  const broken = {
    async getDashboard() {
      throw new Error('/private/path provider-secret');
    },
  } as never;

  const response = await handleRawDataConfigGet(broken);
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await json(response), { error: '原始数据服务暂时不可用' });
});
