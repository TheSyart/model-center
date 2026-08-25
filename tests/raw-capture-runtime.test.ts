import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';

import { getDefaultRawDataAdminService } from '../lib/raw-capture/admin.ts';
import { defaultRawCaptureDependencies } from '../lib/raw-capture/capture.ts';
import {
  createRawCaptureRuntime,
  createRawCaptureRuntimeAccessor,
  type RawCaptureRuntime,
} from '../lib/raw-capture/runtime.ts';

const recordId = '44444444-4444-4444-8444-444444444444';

function localNoonOffset(days: number): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12, 0, 0, 0).getTime();
}

test('runtime accessor coalesces concurrent initialization and retries after failure', async () => {
  const expected = { store: {}, archive: {}, config: {} } as RawCaptureRuntime;
  let calls = 0;
  const getRuntime = createRawCaptureRuntimeAccessor(async () => {
    calls += 1;
    if (calls === 1) throw new Error('first initialization failed');
    return expected;
  });

  const first = getRuntime();
  const concurrent = getRuntime();
  assert.equal(first, concurrent);
  await assert.rejects(first, /first initialization failed/);
  assert.equal(calls, 1);

  const retry = getRuntime();
  assert.equal(await retry, expected);
  assert.equal(calls, 2);
  assert.equal(getRuntime(), retry);
});

test('default capture and admin composition share one runtime and trigger real lazy archiving', async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'model-center-raw-runtime-'));
  const rootDir = join(dataDir, 'raw-captures');
  const sqlite = new Database(join(dataDir, 'model-center.db'));
  const runtime = createRawCaptureRuntime(sqlite, {
    store: {
      rootDir,
      now: () => localNoonOffset(-1),
      id: () => recordId,
    },
    archive: {
      rootDir,
      now: () => localNoonOffset(0),
    },
  });
  const globalRuntime = globalThis as typeof globalThis & {
    __modelCenterRawCaptureRuntimePromise?: Promise<RawCaptureRuntime>;
  };
  globalRuntime.__modelCenterRawCaptureRuntimePromise = Promise.resolve(runtime);
  t.after(() => {
    delete globalRuntime.__modelCenterRawCaptureRuntimePromise;
    sqlite.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  const session = await runtime.store.beginRecord({
    entryProtocol: 'anthropic',
    path: '/v1/messages',
    requestBody: Buffer.from('old request'),
  });
  await session.appendResponse(Buffer.from('old response'));
  await session.finish({
    status: 200,
    stream: false,
    contentType: 'application/json',
    complete: true,
  });

  const [firstStore, secondStore] = await Promise.all([
    defaultRawCaptureDependencies.createStore(),
    defaultRawCaptureDependencies.createStore(),
  ]);
  assert.equal(firstStore, runtime.store);
  assert.equal(secondStore, runtime.store);

  await defaultRawCaptureDependencies.triggerArchiveCheck();
  assert.equal(runtime.archive.listArchives().length, 1);
  assert.equal(runtime.store.getRecord(recordId)?.location, 'archived');

  const admin = await getDefaultRawDataAdminService();
  const dashboard = await admin.getDashboard();
  assert.equal(dashboard.status.rootDir, runtime.store.rootDir);
  assert.equal(dashboard.status.archiveCount, 1);
});
