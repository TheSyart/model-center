import assert from 'node:assert/strict';
import {
  copyFileSync,
  cpSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import test, { type TestContext } from 'node:test';
import { createGunzip, createGzip } from 'node:zlib';
import Database from 'better-sqlite3';
import * as tar from 'tar-stream';

import {
  createRawCaptureArchiveService,
  type CreateArchiveInput,
} from '../lib/raw-capture/archive.ts';
import { createRawCaptureStore } from '../lib/raw-capture/store.ts';
import type { RawCaptureStore } from '../lib/raw-capture/store.ts';
import type { RawCaptureRecord } from '../lib/raw-capture/types.ts';

const recordA = '11111111-1111-4111-8111-111111111111';
const recordB = '22222222-2222-4222-8222-222222222222';
const recordC = '33333333-3333-4333-8333-333333333333';
const day25 = '2026-08-25';
const day26 = '2026-08-26';
const day27 = '2026-08-27';

function localNoon(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12, 0, 0, 0).getTime();
}

const now26 = localNoon(day26);
const requestBytes = Buffer.from([0, 255, 123, 32, 10, 228, 184, 150, 231, 149, 140]);
const responseBytes = Buffer.from('data: {"content":"原样"}\n\n', 'utf8');

interface Fixture {
  rootDir: string;
  sqlite: Database.Database;
  store: RawCaptureStore;
  complete(day: string, id: string, request?: Uint8Array, response?: Uint8Array): Promise<void>;
  incomplete(day: string, id: string): Promise<void>;
}

function createFixture(t: TestContext): Fixture {
  const rootDir = mkdtempSync(join(tmpdir(), 'model-center-raw-archive-'));
  const sqlite = new Database(':memory:');
  let timestamp = localNoon(day25);
  let nextId = recordA;
  const store = createRawCaptureStore(sqlite, {
    rootDir,
    now: () => timestamp,
    id: () => nextId,
  });

  t.after(() => {
    sqlite.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  return {
    rootDir,
    sqlite,
    store,
    async complete(day, id, request = requestBytes, response = responseBytes) {
      timestamp = localNoon(day);
      nextId = id;
      const session = await store.beginRecord({
        entryProtocol: 'anthropic',
        path: '/v1/messages',
        requestBody: request,
      });
      await session.appendResponse(response);
      await session.finish({
        status: 200,
        stream: true,
        contentType: 'text/event-stream',
        complete: true,
      });
    },
    async incomplete(day, id) {
      timestamp = localNoon(day);
      nextId = id;
      const session = await store.beginRecord({
        entryProtocol: 'responses',
        path: '/v1/responses',
        requestBody: requestBytes,
      });
      await session.appendResponse(responseBytes.subarray(0, 4));
      await session.fail('client cancelled');
    },
  };
}

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function readTarEntries(archiveFile: string): Promise<Array<{ name: string; body: Buffer }>> {
  const entries: Array<{ name: string; body: Buffer }> = [];
  const extract = tar.extract();
  extract.on('entry', (header, stream, next) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: unknown) => {
      chunks.push(Buffer.from(chunk as Uint8Array));
    });
    stream.on('end', () => {
      entries.push({ name: header.name, body: Buffer.concat(chunks) });
      next();
    });
    stream.resume();
  });
  const { createReadStream } = await import('node:fs');
  await pipeline(createReadStream(archiveFile), createGunzip(), extract as unknown as Writable);
  return entries;
}

interface TarFixtureEntry {
  name: string;
  body?: Buffer;
  type?: 'file' | 'directory';
}

async function writeTarFixture(path: string, entries: TarFixtureEntry[]): Promise<void> {
  const pack = tar.pack();
  const writing = pipeline(pack, createGzip(), createWriteStream(path, { flags: 'wx', mode: 0o600 }));
  for (const entry of entries) {
    const body = entry.body ?? Buffer.alloc(0);
    await new Promise<void>((resolve, reject) => {
      pack.entry({
        name: entry.name,
        type: entry.type ?? 'file',
        size: entry.type === 'directory' ? 0 : body.length,
        mode: 0o600,
        uid: 0,
        gid: 0,
        mtime: new Date(0),
      }, body, (error?: Error | null) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  pack.finalize();
  await writing;
}

function archivedMetadata(overrides: Partial<RawCaptureRecord> = {}): RawCaptureRecord {
  return {
    id: recordA,
    day: day25,
    startedAt: localNoon(day25),
    completedAt: localNoon(day25) + 100,
    path: '/v1/messages',
    entryProtocol: 'anthropic',
    status: 200,
    stream: false,
    contentType: 'application/json',
    requestBytes: 3,
    responseBytes: 4,
    complete: true,
    captureError: null,
    location: 'active',
    ...overrides,
  };
}

function validTarEntries(metadata = archivedMetadata()): TarFixtureEntry[] {
  return [
    { name: `${recordA}/metadata.json`, body: Buffer.from(JSON.stringify(metadata)) },
    { name: `${recordA}/request.body`, body: Buffer.from('req') },
    { name: `${recordA}/response.body`, body: Buffer.from('resp') },
  ];
}

test('creates one verified tar.gz for a closed local day in deterministic order', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordB, Buffer.from('request-b'), Buffer.from('response-b'));
  await fixture.complete(day25, recordA, requestBytes, responseBytes);
  const sourceMetadata = readFileSync(join(fixture.rootDir, 'active', day25, recordA, 'metadata.json'));
  const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });

  const result = await archive.archiveClosedDays(now26);

  assert.deepEqual(result, { archived: [day25], skipped: [], errors: [] });
  const finalArchive = join(fixture.rootDir, 'archives', `${day25}.tar.gz`);
  assert.equal(existsSync(finalArchive), true);
  assert.equal(existsSync(join(fixture.rootDir, 'active', day25)), false);
  assert.deepEqual(
    (await readTarEntries(finalArchive)).map((entry) => entry.name),
    [
      `${recordA}/metadata.json`,
      `${recordA}/request.body`,
      `${recordA}/response.body`,
      `${recordB}/metadata.json`,
      `${recordB}/request.body`,
      `${recordB}/response.body`,
    ],
  );
  const entries = await readTarEntries(finalArchive);
  assert.deepEqual(entries.find((entry) => entry.name === `${recordA}/metadata.json`)?.body, sourceMetadata);
  const archivedRecord = fixture.store.getRecord(recordA);
  assert.equal(archivedRecord?.location, 'archived');
  assert.deepEqual(await readAll(archive.openArchivedPart(archivedRecord!, 'request')), requestBytes);
  assert.deepEqual(await readAll(archive.openArchivedPart(archivedRecord!, 'response')), responseBytes);
  assert.deepEqual(await readAll(await archive.openArchive(day25)), readFileSync(finalArchive));
  assert.equal(archive.listArchives()[0]?.recordCount, 2);
});

test('skips a closed day with an unfinished record', async (t) => {
  const fixture = createFixture(t);
  await fixture.incomplete(day25, recordA);
  const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });

  const result = await archive.archiveClosedDays(now26);

  assert.deepEqual(result.skipped, [{ day: day25, reason: 'unfinished_records' }]);
  assert.deepEqual(result.archived, []);
  assert.equal(existsSync(join(fixture.rootDir, 'active', day25)), true);
  assert.equal(existsSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`)), false);
});

test('never archives or reconciles the current local day', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day26, recordA);
  writeFileSync(join(fixture.rootDir, 'archives', `${day26}.tar.gz`), Buffer.from('not a real archive'));
  const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });

  const result = await archive.archiveClosedDays(now26);

  assert.deepEqual(result, { archived: [], skipped: [], errors: [] });
  assert.equal(existsSync(join(fixture.rootDir, 'active', day26)), true);
  assert.equal(fixture.store.getRecord(recordA)?.location, 'active');
});

test('archive creation failure keeps the source and never publishes a final archive', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA);
  const archive = createRawCaptureArchiveService(fixture.store, {
    rootDir: fixture.rootDir,
    createArchive: async () => {
      throw new Error('compression exploded');
    },
  });

  const result = await archive.archiveClosedDays(now26);

  assert.deepEqual(result.errors, [{ day: day25, message: 'compression exploded' }]);
  assert.equal(existsSync(join(fixture.rootDir, 'active', day25)), true);
  assert.equal(existsSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`)), false);
  assert.equal(fixture.store.getRecord(recordA)?.location, 'active');
  assert.equal(fixture.store.listArchives()[0]?.status, 'error');
  assert.match(fixture.store.listArchives()[0]?.error ?? '', /compression exploded/);

  const retry = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });
  const recovered = await retry.archiveClosedDays(now26);
  assert.deepEqual(recovered.archived, [day25]);
  assert.equal(fixture.store.listArchives()[0]?.status, 'ready');
  assert.equal(fixture.store.listArchives()[0]?.error, null);
});

test('verification failure keeps the source and does not publish invalid bytes', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA);
  const archive = createRawCaptureArchiveService(fixture.store, {
    rootDir: fixture.rootDir,
    createArchive: async ({ tempPath }: CreateArchiveInput) => {
      writeFileSync(tempPath, Buffer.from('not gzip'), { flag: 'wx', mode: 0o600 });
    },
  });

  const result = await archive.archiveClosedDays(now26);

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]?.message ?? '', /archive|gzip|归档|incorrect/i);
  assert.equal(existsSync(join(fixture.rootDir, 'active', day25)), true);
  assert.equal(existsSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`)), false);
  assert.deepEqual(readdirSync(join(fixture.rootDir, 'tmp')), []);
});

test('recovers a valid final archive whose SQLite rows still say active', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA);
  const first = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });
  await first.archiveClosedDays(now26);
  fixture.sqlite.prepare('DELETE FROM raw_capture_archives WHERE day = ?').run(day25);
  fixture.sqlite.prepare("UPDATE raw_capture_records SET location = 'active' WHERE day = ?").run(day25);

  const recovered = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });
  const result = await recovered.archiveClosedDays(now26);

  assert.deepEqual(result.errors, []);
  assert.equal(fixture.store.getRecord(recordA)?.location, 'archived');
  assert.equal(recovered.listArchives()[0]?.day, day25);
  assert.deepEqual(await readAll(recovered.openArchivedPart(fixture.store.getRecord(recordA)!, 'request')), requestBytes);
});

test('reconstructs complete archive and record indexes from a verified tar after SQLite loss', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA, Buffer.from('req'), Buffer.from('resp'));
  await createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir }).archiveClosedDays(now26);

  const replacementDb = new Database(':memory:');
  t.after(() => replacementDb.close());
  const replacementStore = createRawCaptureStore(replacementDb, { rootDir: fixture.rootDir });
  const recovered = createRawCaptureArchiveService(replacementStore, {
    rootDir: fixture.rootDir,
    now: () => now26,
  });

  const result = await recovered.archiveClosedDays(now26);
  const restoredRecord = replacementStore.getRecord(recordA);

  assert.deepEqual(result.errors, []);
  assert.equal(restoredRecord?.location, 'archived');
  assert.equal(restoredRecord?.complete, true);
  assert.equal(restoredRecord?.requestBytes, 3);
  assert.equal(restoredRecord?.responseBytes, 4);
  assert.equal(replacementStore.listArchives()[0]?.day, day25);
  assert.deepEqual(await readAll(recovered.openArchivedPart(restoredRecord!, 'request')), Buffer.from('req'));
});

test('rejects semantically corrupt final tar files without rebuilding SQLite', async (t) => {
  const corruptCases: Array<{ name: string; entries: TarFixtureEntry[] }> = [
    {
      name: 'duplicate entry',
      entries: [...validTarEntries(), validTarEntries()[0]!],
    },
    {
      name: 'unexpected entry',
      entries: [...validTarEntries(), { name: `${recordA}/extra.bin`, body: Buffer.from('x') }],
    },
    {
      name: 'non-file entry',
      entries: validTarEntries().map((entry) => entry.name.endsWith('request.body')
        ? { name: entry.name, type: 'directory' as const }
        : entry),
    },
    {
      name: 'invalid path',
      entries: [...validTarEntries(), { name: '../request.body', body: Buffer.from('x') }],
    },
    {
      name: 'inconsistent body size',
      entries: validTarEntries(archivedMetadata({ requestBytes: 99 })),
    },
    {
      name: 'metadata day mismatch',
      entries: validTarEntries(archivedMetadata({ day: '2026-08-24' })),
    },
    {
      name: 'metadata id mismatch',
      entries: validTarEntries(archivedMetadata({ id: recordB })),
    },
  ];

  for (const corrupt of corruptCases) {
    await t.test(corrupt.name, async () => {
      const rootDir = mkdtempSync(join(tmpdir(), 'model-center-raw-corrupt-'));
      const sqlite = new Database(':memory:');
      try {
        const store = createRawCaptureStore(sqlite, { rootDir });
        const target = join(rootDir, 'archives', `${day25}.tar.gz`);
        await writeTarFixture(target, corrupt.entries);
        const archive = createRawCaptureArchiveService(store, { rootDir, now: () => now26 });

        const result = await archive.archiveClosedDays(now26);

        assert.equal(result.errors.length, 1);
        assert.equal(store.listArchives().some((item) => item.status === 'ready'), false);
        assert.equal(store.getRecord(recordA), undefined);
        assert.equal(existsSync(target), true);
      } finally {
        sqlite.close();
        rmSync(rootDir, { recursive: true, force: true });
      }
    });
  }
});

test('ignores even a valid current or future archive during reconstruction', async (t) => {
  for (const archiveDay of [day26, day27]) {
    const rootDir = mkdtempSync(join(tmpdir(), 'model-center-raw-future-'));
    const sqlite = new Database(':memory:');
    try {
      const store = createRawCaptureStore(sqlite, { rootDir });
      const metadata = archivedMetadata({ day: archiveDay, startedAt: localNoon(archiveDay), completedAt: localNoon(archiveDay) + 1 });
      await writeTarFixture(join(rootDir, 'archives', `${archiveDay}.tar.gz`), validTarEntries(metadata));
      const archive = createRawCaptureArchiveService(store, { rootDir, now: () => now26 });

      const result = await archive.archiveClosedDays(now26);

      assert.deepEqual(result, { archived: [], skipped: [], errors: [] });
      assert.deepEqual(store.listArchives(), []);
      assert.equal(store.getRecord(recordA), undefined);
    } finally {
      sqlite.close();
      rmSync(rootDir, { recursive: true, force: true });
    }
  }
});

test('removes the exact leftover source after archive index commit recovery', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA);
  const backup = join(fixture.rootDir, 'source-backup');
  cpSync(join(fixture.rootDir, 'active', day25), backup, { recursive: true });
  const first = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });
  await first.archiveClosedDays(now26);
  cpSync(backup, join(fixture.rootDir, 'active', day25), { recursive: true });

  const recovered = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });
  const result = await recovered.archiveClosedDays(now26);

  assert.deepEqual(result.errors, []);
  assert.equal(fixture.store.getRecord(recordA)?.location, 'archived');
  assert.equal(existsSync(join(fixture.rootDir, 'active', day25)), false);
});

test('serializes archive runs across service instances for the same root', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA);
  let createCalls = 0;
  const failingWriter = async (): Promise<void> => {
    createCalls += 1;
    await new Promise<void>((resolve) => setImmediate(resolve));
    throw new Error('controlled failure');
  };
  const first = createRawCaptureArchiveService(fixture.store, {
    rootDir: fixture.rootDir,
    createArchive: failingWriter,
  });
  const second = createRawCaptureArchiveService(fixture.store, {
    rootDir: fixture.rootDir,
    createArchive: failingWriter,
  });

  const [firstResult, secondResult] = await Promise.all([
    first.archiveClosedDays(now26),
    second.archiveClosedDays(now26),
  ]);

  assert.equal(createCalls, 1);
  assert.deepEqual(secondResult, firstResult);
  assert.equal(existsSync(join(fixture.rootDir, 'active', day25)), true);
});

test('cleans only stale UUID archive temp files and leaves current-day directories untouched', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day26, recordA);
  const stale = join(fixture.rootDir, 'tmp', `${day25}.44444444-4444-4444-8444-444444444444.tar.gz`);
  const recent = join(fixture.rootDir, 'tmp', `${day25}.55555555-5555-4555-8555-555555555555.tar.gz`);
  const unrelated = join(fixture.rootDir, 'tmp', 'keep-me.txt');
  writeFileSync(stale, 'partial');
  writeFileSync(recent, 'partial');
  writeFileSync(unrelated, 'private');
  const oldTime = new Date(now26 - 25 * 60 * 60 * 1000);
  utimesSync(stale, oldTime, oldTime);
  utimesSync(unrelated, oldTime, oldTime);

  const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });
  await archive.archiveClosedDays(now26);

  assert.equal(existsSync(stale), false);
  assert.equal(existsSync(recent), true);
  assert.equal(existsSync(unrelated), true);
  assert.equal(lstatSync(join(fixture.rootDir, 'active', day26)).isDirectory(), true);
});

test('recovers delete tombstones on both database crash boundaries', async (t) => {
  const restoreFixture = createFixture(t);
  await restoreFixture.complete(day25, recordA, Buffer.from('req'), Buffer.from('resp'));
  const restoreService = createRawCaptureArchiveService(restoreFixture.store, { rootDir: restoreFixture.rootDir });
  await restoreService.archiveClosedDays(now26);
  const restoreFinal = join(restoreFixture.rootDir, 'archives', `${day25}.tar.gz`);
  const restoreTombstone = join(
    restoreFixture.rootDir,
    'tmp',
    `delete-${day25}.44444444-4444-4444-8444-444444444444.tar.gz`,
  );
  renameSync(restoreFinal, restoreTombstone);

  const restored = await createRawCaptureArchiveService(restoreFixture.store, {
    rootDir: restoreFixture.rootDir,
  }).archiveClosedDays(now26);

  assert.deepEqual(restored.errors, []);
  assert.equal(existsSync(restoreFinal), true);
  assert.equal(existsSync(restoreTombstone), false);
  assert.equal(restoreFixture.store.getRecord(recordA)?.location, 'archived');

  const deleteFixture = createFixture(t);
  await deleteFixture.complete(day25, recordB, Buffer.from('req'), Buffer.from('resp'));
  const deleteService = createRawCaptureArchiveService(deleteFixture.store, { rootDir: deleteFixture.rootDir });
  await deleteService.archiveClosedDays(now26);
  const deleteFinal = join(deleteFixture.rootDir, 'archives', `${day25}.tar.gz`);
  const deleteTombstone = join(
    deleteFixture.rootDir,
    'tmp',
    `delete-${day25}.55555555-5555-4555-8555-555555555555.tar.gz`,
  );
  renameSync(deleteFinal, deleteTombstone);
  assert.equal(deleteFixture.store.deleteArchivedDay(day25), true);

  const deleted = await createRawCaptureArchiveService(deleteFixture.store, {
    rootDir: deleteFixture.rootDir,
  }).archiveClosedDays(now26);

  assert.deepEqual(deleted.errors, []);
  assert.equal(existsSync(deleteFinal), false);
  assert.equal(existsSync(deleteTombstone), false);
  assert.equal(deleteFixture.store.getRecord(recordB), undefined);
});

test('preserves both files on final and delete-tombstone conflict', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA, Buffer.from('req'), Buffer.from('resp'));
  const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });
  await archive.archiveClosedDays(now26);
  const finalPath = join(fixture.rootDir, 'archives', `${day25}.tar.gz`);
  const tombstone = join(
    fixture.rootDir,
    'tmp',
    `delete-${day25}.66666666-6666-4666-8666-666666666666.tar.gz`,
  );
  copyFileSync(finalPath, tombstone);

  const result = await archive.archiveClosedDays(now26);

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]?.message ?? '', /冲突|conflict/i);
  assert.equal(existsSync(finalPath), true);
  assert.equal(existsSync(tombstone), true);
  assert.equal(fixture.store.getRecord(recordA)?.location, 'archived');
});

test('rejects replaced managed archive parents and matching tombstone symlinks without outside mutation', async (t) => {
  for (const parent of ['archives', 'tmp'] as const) {
    const fixture = createFixture(t);
    await fixture.complete(day25, recordA, Buffer.from('req'), Buffer.from('resp'));
    const outside = mkdtempSync(join(tmpdir(), 'model-center-raw-outside-'));
    t.after(() => rmSync(outside, { recursive: true, force: true }));
    rmSync(join(fixture.rootDir, parent), { recursive: true, force: true });
    symlinkSync(outside, join(fixture.rootDir, parent), 'dir');
    const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });

    await assert.rejects(() => archive.archiveClosedDays(now26), /符号链接|managed|安全/i);
    assert.deepEqual(readdirSync(outside), []);
    assert.equal(fixture.store.getRecord(recordA)?.location, 'active');
  }

  const fixture = createFixture(t);
  const outside = mkdtempSync(join(tmpdir(), 'model-center-raw-tombstone-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const outsideFile = join(outside, 'private.tar.gz');
  writeFileSync(outsideFile, 'private');
  const tombstone = join(
    fixture.rootDir,
    'tmp',
    `delete-${day25}.77777777-7777-4777-8777-777777777777.tar.gz`,
  );
  symlinkSync(outsideFile, tombstone);
  const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });

  await assert.rejects(() => archive.archiveClosedDays(now26), /符号链接|普通文件|安全/i);
  assert.equal(readFileSync(outsideFile, 'utf8'), 'private');
});

test('rejects symlinked active day and record parents before archive reads or removal', async (t) => {
  for (const replaced of ['day', 'record'] as const) {
    const fixture = createFixture(t);
    await fixture.complete(day25, recordA, Buffer.from('private-request'), Buffer.from('private-response'));
    const outside = mkdtempSync(join(tmpdir(), 'model-center-raw-active-outside-'));
    t.after(() => rmSync(outside, { recursive: true, force: true }));
    const source = replaced === 'day'
      ? join(fixture.rootDir, 'active', day25)
      : join(fixture.rootDir, 'active', day25, recordA);
    const moved = join(outside, replaced);
    renameSync(source, moved);
    symlinkSync(moved, source, 'dir');
    const before = readFileSync(join(moved, ...(replaced === 'day' ? [recordA] : []), 'request.body'));
    const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });

    const result = await archive.archiveClosedDays(now26);

    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0]?.message ?? '', /符号链接|managed|安全/i);
    assert.deepEqual(
      readFileSync(join(moved, ...(replaced === 'day' ? [recordA] : []), 'request.body')),
      before,
    );
    assert.equal(existsSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`)), false);
    assert.equal(fixture.store.getRecord(recordA)?.location, 'active');
  }
});

test('does not overwrite an existing daily archive when a late active record appears', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA, Buffer.from('first'), Buffer.from('archive'));
  const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });
  await archive.archiveClosedDays(now26);
  const original = readFileSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`));
  await fixture.complete(day25, recordB, Buffer.from('late'), Buffer.from('record'));

  const result = await archive.archiveClosedDays(now26);

  assert.deepEqual(result.skipped, [{ day: day25, reason: 'already_archived' }]);
  assert.deepEqual(readFileSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`)), original);
  assert.equal(existsSync(join(fixture.rootDir, 'active', day25, recordB)), true);
  assert.equal(fixture.store.getRecord(recordB)?.location, 'active');
});

test('rejects symlinked source parts without deleting the active day', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA);
  const requestPath = join(fixture.rootDir, 'active', day25, recordA, 'request.body');
  rmSync(requestPath);
  const { symlinkSync } = await import('node:fs');
  symlinkSync(join(fixture.rootDir, 'active', day25, recordA, 'response.body'), requestPath);
  const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });

  const result = await archive.archiveClosedDays(now26);

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]?.message ?? '', /symbolic|symlink|普通文件|安全/i);
  assert.equal(existsSync(join(fixture.rootDir, 'active', day25)), true);
  assert.equal(existsSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`)), false);
});

test('deletes only one validated archived day and its archived records', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA);
  await fixture.complete(day26, recordB);
  await fixture.complete(day27, recordC);
  const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });
  await archive.archiveClosedDays(localNoon(day27));

  assert.equal(await archive.deleteArchive(day25), true);

  assert.equal(existsSync(join(fixture.rootDir, 'archives', `${day25}.tar.gz`)), false);
  assert.equal(archive.listArchives().some((item) => item.day === day25), false);
  assert.equal(fixture.store.getRecord(recordA), undefined);
  assert.equal(existsSync(join(fixture.rootDir, 'archives', `${day26}.tar.gz`)), true);
  assert.equal(fixture.store.getRecord(recordB)?.location, 'archived');
  assert.equal(existsSync(join(fixture.rootDir, 'active', day27, recordC)), true);
  assert.equal(fixture.store.getRecord(recordC)?.location, 'active');
});

test('validates archive days, record locations, and final archive file type', async (t) => {
  const fixture = createFixture(t);
  await fixture.complete(day25, recordA);
  const archive = createRawCaptureArchiveService(fixture.store, { rootDir: fixture.rootDir });

  await assert.rejects(() => archive.openArchive('../2026-08-25'), /日期/);
  assert.throws(() => archive.openArchivedPart(fixture.store.getRecord(recordA)!, 'request'), /未归档/);
  await assert.rejects(() => archive.deleteArchive('2026-02-30'), /日期/);

  await archive.archiveClosedDays(now26);
  const target = join(fixture.rootDir, 'archives', `${day25}.tar.gz`);
  const moved = join(fixture.rootDir, 'archives', 'real.tar.gz');
  renameSync(target, moved);
  symlinkSync(moved, target);
  await assert.rejects(() => archive.openArchive(day25), /symbolic|symlink|普通文件|安全/i);
});
