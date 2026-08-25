import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';

import { createRawCaptureConfigStore } from '../lib/raw-capture/config.ts';
import { activeRecordDir, assertArchiveDay, assertRecordId } from '../lib/raw-capture/paths.ts';
import { createRawCaptureStore } from '../lib/raw-capture/store.ts';
import type { RawCaptureRecord } from '../lib/raw-capture/types.ts';

const recordId = '11111111-1111-4111-8111-111111111111';
const day = '2026-08-26';

function createRootDir(): string {
  const rootDir = mkdtempSync(join(tmpdir(), 'model-center-raw-capture-'));
  test.after(() => rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
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
    'archived',
  );

  const recovered = createRawCaptureStore(sqlite, { rootDir }).getRecord(recordId);
  assert.deepEqual(recovered, completed);
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
