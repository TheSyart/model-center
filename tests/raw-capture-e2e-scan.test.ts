import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateExactOnceCapture, type CaptureCandidateObservation } from './raw-capture-e2e-match.ts';
import {
  accumulateRecordsById,
  advanceRecordScanStability,
  initialRecordScanStability,
  scanBoundedRecords,
  type RecordScanPage,
} from './raw-capture-e2e-scan.ts';

interface FakeRecord extends CaptureCandidateObservation {
  path: string;
}

const completed: FakeRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  path: '/v1/messages',
  complete: true,
  status: 200,
  stream: false,
  request: { state: 'exact' },
  response: { state: 'not_checked' },
};

const duplicate: FakeRecord = {
  ...completed,
  id: '22222222-2222-4222-8222-222222222222',
  complete: false,
  status: null,
};

const unrelated: FakeRecord = {
  ...completed,
  id: '33333333-3333-4333-8333-333333333333',
  path: '/v1/responses',
  request: { state: 'different' },
};

const baseline: FakeRecord = {
  ...unrelated,
  id: '44444444-4444-4444-8444-444444444444',
};

test('bounded scan accumulates a duplicate despite growing totals and OFFSET page shifts', async () => {
  const calls: number[] = [];
  const pageOneReads: RecordScanPage<FakeRecord>[] = [
    { items: [completed, unrelated], total: 4, pageSize: 2 },
    { items: [duplicate, completed], total: 6, pageSize: 2 },
  ];

  const scan = await scanBoundedRecords(async (page) => {
    calls.push(page);
    if (page === 1) return pageOneReads.shift()!;
    if (page === 2) return { items: [unrelated, baseline], total: 6, pageSize: 2 };
    return { items: [], total: 6, pageSize: 2 };
  }, {
    maxPages: 2,
    maxRecords: 10,
    isBoundary: (record) => record.id === baseline.id,
  });

  const accumulated = new Map<string, FakeRecord>();
  const newIds = accumulateRecordsById(
    accumulated,
    scan.records,
    (record) => record.path === '/v1/messages',
  );
  const nextPollNewIds = accumulateRecordsById(
    accumulated,
    [completed],
    (record) => record.path === '/v1/messages',
  );
  const stability = advanceRecordScanStability(initialRecordScanStability, scan, newIds);
  const evaluation = evaluateExactOnceCapture(
    [...accumulated.values()],
    { status: 200, stream: false, requireResponse: false },
  );

  assert.deepEqual(calls, [1, 2, 1]);
  assert.equal(scan.requiredPages, 2);
  assert.equal(scan.pageOneStable, false);
  assert.equal(scan.boundaryReached, true);
  assert.deepEqual(new Set(accumulated.keys()), new Set([completed.id, duplicate.id]));
  assert.deepEqual(nextPollNewIds, []);
  assert.equal(stability.ready, false);
  assert.equal(evaluation.ready, false);
  assert.deepEqual(evaluation.exactRequestIds, [completed.id, duplicate.id]);
});

test('scan stops at its fixed cap and reports an unreached baseline boundary', async () => {
  const calls: number[] = [];
  const scan = await scanBoundedRecords(async (page) => {
    calls.push(page);
    return {
      items: [{ ...unrelated, id: `55555555-5555-4555-8555-${String(page).padStart(12, '0')}` }],
      total: page === 1 ? 100 : 200,
      pageSize: 2,
    };
  }, {
    maxPages: 2,
    maxRecords: 10,
    isBoundary: (record) => record.id === baseline.id,
  });

  assert.deepEqual(calls, [1, 2, 1]);
  assert.equal(scan.coverageComplete, false);
  assert.equal(scan.boundaryReached, false);
  assert.match(scan.diagnostic, /scan_cap_reached/);
});

test('requires an additional stable scan after the candidate snapshot', () => {
  const stableScan = { coverageComplete: true, pageOneStable: true };
  const first = advanceRecordScanStability(
    initialRecordScanStability,
    stableScan,
    [completed.id],
  );
  const second = advanceRecordScanStability(first, stableScan, []);

  assert.equal(first.ready, false);
  assert.equal(second.ready, true);
  assert.equal(second.confirmations, 1);
});
