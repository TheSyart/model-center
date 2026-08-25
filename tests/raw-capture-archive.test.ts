import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import test, { type TestContext } from 'node:test';
import { createGunzip } from 'node:zlib';
import Database from 'better-sqlite3';
import * as tar from 'tar-stream';

import {
  createRawCaptureArchiveService,
  type CreateArchiveInput,
} from '../lib/raw-capture/archive.ts';
import { createRawCaptureStore } from '../lib/raw-capture/store.ts';
import type { RawCaptureStore } from '../lib/raw-capture/store.ts';

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
  assert.deepEqual(await readAll(archive.openArchive(day25)), readFileSync(finalArchive));
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

  assert.throws(() => archive.openArchive('../2026-08-25'), /日期/);
  assert.throws(() => archive.openArchivedPart(fixture.store.getRecord(recordA)!, 'request'), /未归档/);
  await assert.rejects(() => archive.deleteArchive('2026-02-30'), /日期/);

  await archive.archiveClosedDays(now26);
  const target = join(fixture.rootDir, 'archives', `${day25}.tar.gz`);
  const moved = join(fixture.rootDir, 'archives', 'real.tar.gz');
  const { renameSync, symlinkSync } = await import('node:fs');
  renameSync(target, moved);
  symlinkSync(moved, target);
  assert.throws(() => archive.openArchive(day25), /symbolic|symlink|普通文件|安全/i);
});
