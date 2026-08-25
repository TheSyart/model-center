import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { open as openFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';

import { createRawCaptureConfigStore } from '../lib/raw-capture/config.ts';
import { activeRecordDir, assertArchiveDay, assertRecordId } from '../lib/raw-capture/paths.ts';
import { observeResponseBody } from '../lib/raw-capture/response-observer.ts';
import { createRawCaptureStore } from '../lib/raw-capture/store.ts';
import type { RawCaptureRecord } from '../lib/raw-capture/types.ts';

const recordId = '11111111-1111-4111-8111-111111111111';
const day = '2026-08-26';

function createRootDir(): string {
  const rootDir = mkdtempSync(join(tmpdir(), 'model-center-raw-capture-'));
  test.after(() => rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const reader = stream.getReader();
  for (;;) {
    const result = await reader.read();
    if (result.done) return Buffer.concat(chunks);
    chunks.push(Buffer.from(result.value));
  }
}

async function within<T>(promise: Promise<T>, milliseconds = 1_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${milliseconds}ms`)), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function createUnfinishedFixture(rootDir: string): string {
  const recordDir = activeRecordDir(rootDir, day, recordId);
  mkdirSync(recordDir, { recursive: true });
  const record: RawCaptureRecord = {
    id: recordId,
    day,
    startedAt: new Date('2026-08-26T03:04:05+08:00').getTime(),
    completedAt: null,
    path: '/v1/messages',
    entryProtocol: 'anthropic',
    status: null,
    stream: false,
    contentType: null,
    requestBytes: 5,
    responseBytes: 0,
    complete: false,
    captureError: null,
    location: 'active',
  };
  writeFileSync(join(recordDir, 'request.body'), Buffer.from('hello'));
  writeFileSync(join(recordDir, 'response.body'), Buffer.alloc(0));
  writeFileSync(join(recordDir, 'metadata.json'), JSON.stringify(record));
  return recordDir;
}

test('defaults capture to disabled and persists only 0 or 1', () => {
  const sqlite = new Database(':memory:');
  const config = createRawCaptureConfigStore(sqlite);
  assert.equal(config.getEnabled(), false);
  config.setEnabled(true);
  assert.equal(config.getEnabled(), true);
  assert.equal(
    (sqlite.prepare("SELECT value FROM settings WHERE key = 'raw_capture_enabled'").get() as { value: string }).value,
    '1',
  );
  config.setEnabled(false);
  assert.equal(
    (sqlite.prepare("SELECT value FROM settings WHERE key = 'raw_capture_enabled'").get() as { value: string }).value,
    '0',
  );
  sqlite.close();
});

test('writes request bytes without parsing or re-encoding', async () => {
  const rootDir = createRootDir();
  const sqlite = new Database(':memory:');
  const request = new TextEncoder().encode('{  "model":"演示", "messages":[] }\n');
  const store = createRawCaptureStore(sqlite, {
    rootDir,
    now: () => new Date('2026-08-26T03:04:05+08:00').getTime(),
    id: () => recordId,
  });
  const session = await store.beginRecord({
    entryProtocol: 'anthropic',
    path: '/v1/messages',
    requestBody: request,
  });
  const recordDir = join(rootDir, 'active', day, recordId);
  assert.deepEqual(readFileSync(join(recordDir, 'request.body')), Buffer.from(request));

  await session.appendResponse(new Uint8Array([0, 255, 1]));
  const finished = await session.finish({
    status: 200,
    stream: false,
    contentType: 'application/json',
    complete: true,
  });
  assert.deepEqual(readFileSync(join(recordDir, 'response.body')), Buffer.from([0, 255, 1]));
  assert.equal(finished.requestBytes, request.byteLength);
  assert.equal(finished.responseBytes, 3);
  assert.equal(store.getRecord(recordId)?.complete, true);
  assert.deepEqual(store.listRecords({ page: 1, pageSize: 10 }).items, [finished]);
  assert.equal(store.getStatus().todayRecords, 1);
  sqlite.close();
});

test('rejects traversal-shaped IDs and dates', () => {
  assert.throws(() => assertRecordId('../secret'), /记录 ID/);
  assert.throws(() => assertArchiveDay('2026-08-26/../x'), /日期/);
});

test('keeps crash-leftover files and exposes the record as incomplete', () => {
  const rootDir = createRootDir();
  const sqlite = new Database(':memory:');
  const recordDir = createUnfinishedFixture(rootDir);
  const recovered = createRawCaptureStore(sqlite, { rootDir }).getRecord(recordId);
  assert.equal(recovered?.complete, false);
  assert.equal(existsSync(join(recordDir, 'request.body')), true);
  assert.equal(recovered?.requestBytes, 5);
  sqlite.close();
});

test('repairs a stale active index row from completed crash-leftover metadata', () => {
  const rootDir = createRootDir();
  const sqlite = new Database(':memory:');
  createRawCaptureStore(sqlite, { rootDir });
  const recordDir = activeRecordDir(rootDir, day, recordId);
  mkdirSync(recordDir, { recursive: true });
  const completed: RawCaptureRecord = {
    id: recordId,
    day,
    startedAt: 1_724_600_245_000,
    completedAt: 1_724_600_249_000,
    path: '/v1/messages',
    entryProtocol: 'anthropic',
    status: 207,
    stream: true,
    contentType: 'text/event-stream',
    requestBytes: 37,
    responseBytes: 91,
    complete: true,
    captureError: null,
    location: 'active',
  };
  writeFileSync(join(recordDir, 'request.body'), Buffer.alloc(completed.requestBytes));
  writeFileSync(join(recordDir, 'response.body'), Buffer.alloc(completed.responseBytes));
  writeFileSync(join(recordDir, 'metadata.json'), JSON.stringify(completed));
  sqlite.prepare(`
    INSERT INTO raw_capture_records (
      id, day, started_at, completed_at, path, entry_protocol, status, stream, content_type,
      request_bytes, response_bytes, complete, capture_error, location
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordId,
    '2026-01-01',
    1,
    null,
    '/stale',
    'openai',
    null,
    0,
    null,
    0,
    0,
    0,
    'crashed before index update',
    'active',
  );

  const recovered = createRawCaptureStore(sqlite, { rootDir }).getRecord(recordId);
  assert.deepEqual(recovered, completed);
  sqlite.close();
});

test('never downgrades an archived index row when stale active files remain', () => {
  const rootDir = createRootDir();
  const sqlite = new Database(':memory:');
  createUnfinishedFixture(rootDir);
  createRawCaptureStore(sqlite, { rootDir });
  sqlite.prepare(`UPDATE raw_capture_records SET location = 'archived', complete = 1, capture_error = NULL WHERE id = ?`).run(recordId);

  const recovered = createRawCaptureStore(sqlite, { rootDir }).getRecord(recordId);

  assert.equal(recovered?.location, 'archived');
  assert.equal(recovered?.complete, true);
  assert.equal(recovered?.captureError, null);
  sqlite.close();
});

test('crash recovery uses exact regular-file sizes and marks stale unfinished metadata incomplete', () => {
  const rootDir = createRootDir();
  const sqlite = new Database(':memory:');
  const recordDir = createUnfinishedFixture(rootDir);
  writeFileSync(join(recordDir, 'request.body'), Buffer.from('request grew'));
  writeFileSync(join(recordDir, 'response.body'), Buffer.from('response written before metadata'));

  const store = createRawCaptureStore(sqlite, { rootDir });
  const recovered = store.getRecord(recordId);

  assert.equal(recovered?.requestBytes, Buffer.byteLength('request grew'));
  assert.equal(recovered?.responseBytes, Buffer.byteLength('response written before metadata'));
  assert.equal(recovered?.complete, false);
  assert.match(recovered?.captureError ?? '', /恢复|未完成|stale/i);
  sqlite.close();
});

test('crash recovery never follows symlink or non-file body entries', () => {
  for (const unsafePart of ['request.body', 'response.body'] as const) {
    const rootDir = createRootDir();
    const outside = createRootDir();
    const sqlite = new Database(':memory:');
    const recordDir = createUnfinishedFixture(rootDir);
    rmSync(join(recordDir, unsafePart), { recursive: true, force: true });
    const outsideFile = join(outside, `${unsafePart}.outside`);
    writeFileSync(outsideFile, Buffer.from('outside-secret'));
    symlinkSync(outsideFile, join(recordDir, unsafePart));

    const recovered = createRawCaptureStore(sqlite, { rootDir }).getRecord(recordId);

    assert.equal(recovered?.complete, false);
    assert.match(recovered?.captureError ?? '', /普通文件|符号链接|安全/i);
    assert.equal(readFileSync(outsideFile, 'utf8'), 'outside-secret');
    sqlite.close();
  }

  const rootDir = createRootDir();
  const sqlite = new Database(':memory:');
  const recordDir = createUnfinishedFixture(rootDir);
  rmSync(join(recordDir, 'response.body'));
  mkdirSync(join(recordDir, 'response.body'));
  const recovered = createRawCaptureStore(sqlite, { rootDir }).getRecord(recordId);
  assert.equal(recovered?.complete, false);
  assert.match(recovered?.captureError ?? '', /普通文件|安全/i);
  sqlite.close();
});

test('rejects managed parent symlinks without mutating their external targets', async () => {
  for (const managedName of ['active', 'archives', 'tmp'] as const) {
    const rootDir = createRootDir();
    const outside = createRootDir();
    symlinkSync(outside, join(rootDir, managedName), 'dir');
    const sqlite = new Database(':memory:');

    assert.throws(() => createRawCaptureStore(sqlite, { rootDir }), /符号链接|managed|安全/i);
    assert.deepEqual(readdirSync(outside), []);
    sqlite.close();
  }

  const rootDir = createRootDir();
  const outside = createRootDir();
  const sqlite = new Database(':memory:');
  const store = createRawCaptureStore(sqlite, {
    rootDir,
    now: () => new Date('2026-08-26T03:04:05+08:00').getTime(),
    id: () => recordId,
  });
  symlinkSync(outside, join(rootDir, 'active', day), 'dir');

  await assert.rejects(() => store.beginRecord({
    entryProtocol: 'anthropic',
    path: '/v1/messages',
    requestBody: Buffer.from('must-not-escape'),
  }), /符号链接|managed|安全/i);
  assert.deepEqual(readdirSync(outside), []);
  sqlite.close();
});

test('real store response sink remains asynchronous while preserving exact observed bytes', async () => {
  const rootDir = createRootDir();
  const sqlite = new Database(':memory:');
  const writeStarted = deferred<void>();
  const writeGate = deferred<void>();
  const store = createRawCaptureStore(sqlite, {
    rootDir,
    now: () => new Date('2026-08-26T03:04:05+08:00').getTime(),
    id: () => recordId,
    async openResponseFile(path) {
      const handle = await openFile(path, 'wx', 0o600);
      return {
        async write(buffer, offset, length, position) {
          writeStarted.resolve();
          await writeGate.promise;
          return handle.write(buffer, offset, length, position);
        },
        sync: () => handle.sync(),
        close: () => handle.close(),
      };
    },
  });
  const session = await store.beginRecord({
    entryProtocol: 'anthropic',
    path: '/v1/messages',
    requestBody: Buffer.from('request'),
  });
  const upstream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Buffer.from('first-'));
      controller.enqueue(Buffer.from('second'));
      controller.close();
    },
  });
  const observed = observeResponseBody(upstream, {
    write: (chunk) => session.appendResponse(chunk),
    close: (result) => session.finish({
      status: 200,
      stream: true,
      contentType: 'text/event-stream',
      complete: result.complete,
      captureError: result.captureError,
    }).then(() => undefined),
    fail: (error) => session.fail(String(error)).then(() => undefined),
  });
  let captureSettled = false;
  void observed.done.then(() => { captureSettled = true; });

  const clientBody = await within(readAll(observed.stream));
  await writeStarted.promise;
  assert.equal(clientBody.toString(), 'first-second');
  assert.equal(captureSettled, false);

  writeGate.resolve();
  const result = await observed.done;
  assert.deepEqual(result, { complete: true, responseBytes: 12, captureError: null });
  assert.deepEqual(
    readFileSync(join(rootDir, 'active', day, recordId, 'response.body')),
    Buffer.from('first-second'),
  );
  assert.equal(store.getRecord(recordId)?.complete, true);
  sqlite.close();
});

test('async response sink serializes partial writes and finalization races', async () => {
  const rootDir = createRootDir();
  const sqlite = new Database(':memory:');
  const store = createRawCaptureStore(sqlite, {
    rootDir,
    now: () => new Date('2026-08-26T03:04:05+08:00').getTime(),
    id: () => recordId,
    async openResponseFile(path) {
      const handle = await openFile(path, 'wx', 0o600);
      return {
        write: (buffer, offset, length, position) => handle.write(buffer, offset, Math.min(length, 2), position),
        sync: () => handle.sync(),
        close: () => handle.close(),
      };
    },
  });
  const session = await store.beginRecord({
    entryProtocol: 'responses',
    path: '/v1/responses',
    requestBody: Buffer.from('request'),
  });

  await Promise.all([
    session.appendResponse(Buffer.from('abc')),
    session.appendResponse(Buffer.from('def')),
  ]);
  const finish = session.finish({ status: 200, stream: false, contentType: 'application/json', complete: true });
  const fail = session.fail('late failure must not replace first finalization');
  const [finished, failed] = await Promise.all([finish, fail]);

  assert.equal(finished, failed);
  assert.equal(finished.complete, true);
  assert.equal(finished.responseBytes, 6);
  assert.deepEqual(readFileSync(join(rootDir, 'active', day, recordId, 'response.body')), Buffer.from('abcdef'));
  await assert.rejects(() => session.appendResponse(Buffer.from('late')), /结束|final/i);
  sqlite.close();
});

test('async response sink records sync and close failures without losing client bytes', async () => {
  const rootDir = createRootDir();
  const sqlite = new Database(':memory:');
  const store = createRawCaptureStore(sqlite, {
    rootDir,
    now: () => new Date('2026-08-26T03:04:05+08:00').getTime(),
    id: () => recordId,
    async openResponseFile(path) {
      const handle = await openFile(path, 'wx', 0o600);
      return {
        write: (buffer, offset, length, position) => handle.write(buffer, offset, length, position),
        async sync() {
          throw new Error('async sync failed');
        },
        async close() {
          await handle.close();
          throw new Error('async close failed');
        },
      };
    },
  });
  const session = await store.beginRecord({
    entryProtocol: 'openai',
    path: '/v1/chat/completions',
    requestBody: Buffer.from('request'),
  });
  await session.appendResponse(Buffer.from('client-bytes'));

  const finished = await session.finish({
    status: 200,
    stream: false,
    contentType: 'application/octet-stream',
    complete: true,
  });

  assert.equal(finished.complete, false);
  assert.match(finished.captureError ?? '', /async sync failed/);
  assert.match(finished.captureError ?? '', /async close failed/);
  assert.deepEqual(readFileSync(join(rootDir, 'active', day, recordId, 'response.body')), Buffer.from('client-bytes'));
  sqlite.close();
});

test('marks a failed capture incomplete while retaining bytes already written', async () => {
  const rootDir = createRootDir();
  const sqlite = new Database(':memory:');
  const store = createRawCaptureStore(sqlite, {
    rootDir,
    now: () => new Date('2026-08-26T03:04:05+08:00').getTime(),
    id: () => recordId,
  });
  const session = await store.beginRecord({
    entryProtocol: 'responses',
    path: '/v1/responses',
    requestBody: new Uint8Array([12]),
  });
  await session.appendResponse(new Uint8Array([34, 56]));
  const failed = await session.fail('disk queue overflow');
  assert.equal(failed.complete, false);
  assert.equal(failed.captureError, 'disk queue overflow');
  assert.equal(failed.responseBytes, 2);
  assert.deepEqual(
    readFileSync(join(rootDir, 'active', day, recordId, 'response.body')),
    Buffer.from([34, 56]),
  );
  sqlite.close();
});
