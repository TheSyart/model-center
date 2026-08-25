import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateExactOnceCapture, type CaptureCandidateObservation } from './raw-capture-e2e-match.ts';
import {
  accumulateCappedRecordsById,
  advanceRecordScanStability,
  createCappedRecordAccumulator,
  initialRecordScanStability,
  mapAccumulatedRecords,
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

const thirdCandidate: FakeRecord = {
  ...completed,
  id: '66666666-6666-4666-8666-666666666666',
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

  const accumulator = createCappedRecordAccumulator<FakeRecord>(10);
  const accumulation = accumulateCappedRecordsById(
    accumulator,
    scan.records,
    (record) => record.path === '/v1/messages',
  );
  const nextPoll = accumulateCappedRecordsById(
    accumulator,
    [completed],
    (record) => record.path === '/v1/messages',
  );
  const stability = advanceRecordScanStability(
    initialRecordScanStability,
    scan,
    accumulation.newIds,
  );
  const evaluation = evaluateExactOnceCapture(
    [...accumulator.records.values()],
    { status: 200, stream: false, requireResponse: false },
  );

  assert.deepEqual(calls, [1, 2, 1]);
  assert.equal(scan.requiredPages, 2);
  assert.equal(scan.pageOneStable, false);
  assert.equal(scan.boundaryReached, true);
  assert.deepEqual(new Set(accumulator.records.keys()), new Set([completed.id, duplicate.id]));
  assert.deepEqual(nextPoll.newIds, []);
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

test('allows exactly the cumulative cap then permanently rejects cap plus one', async () => {
  const accumulator = createCappedRecordAccumulator<FakeRecord>(2);
  const listCalls: number[] = [];
  const scanRound = (items: FakeRecord[]) => scanBoundedRecords(async (page) => {
    listCalls.push(page);
    return { items, total: items.length, pageSize: 10 };
  }, { maxPages: 1, maxRecords: 3 });
  const firstScan = await scanRound([completed]);
  const first = accumulateCappedRecordsById(accumulator, firstScan.records, () => true);
  const secondScan = await scanRound([duplicate]);
  const exactlyCap = accumulateCappedRecordsById(accumulator, secondScan.records, () => true);
  let detailCalls = 0;
  let bodyCalls = 0;
  await mapAccumulatedRecords(accumulator, async () => {
    detailCalls++;
    bodyCalls++;
  });

  const thirdScan = await scanRound([thirdCandidate]);
  const overflow = accumulateCappedRecordsById(accumulator, thirdScan.records, () => true);
  await mapAccumulatedRecords(accumulator, async () => {
    detailCalls++;
    bodyCalls++;
  });
  const later = accumulateCappedRecordsById(accumulator, [completed], () => true);

  assert.equal(first.capped, false);
  assert.equal(exactlyCap.capped, false);
  assert.equal(exactlyCap.candidateCount, 2);
  assert.deepEqual(exactlyCap.newIds, [duplicate.id]);
  assert.equal(overflow.capped, true);
  assert.equal(overflow.attemptedUniqueCount, 3);
  assert.match(overflow.diagnostic, /candidate_cap_reached=true/);
  assert.deepEqual([...accumulator.records.keys()], [completed.id, duplicate.id]);
  assert.equal(later.capped, true);
  assert.equal(later.attemptedUniqueCount, 3);
  assert.deepEqual(listCalls, [1, 1, 1, 1, 1, 1]);
  assert.equal(detailCalls, 2);
  assert.equal(bodyCalls, 2);
});

test('checks main-page and end-page candidates atomically before crossing the cumulative cap', async () => {
  const accumulator = createCappedRecordAccumulator<FakeRecord>(2);
  accumulateCappedRecordsById(accumulator, [completed], () => true);
  const listCalls: number[] = [];
  const pageOneReads: RecordScanPage<FakeRecord>[] = [
    { items: [duplicate], total: 1, pageSize: 1 },
    { items: [thirdCandidate], total: 2, pageSize: 1 },
  ];
  const scan = await scanBoundedRecords(async (page) => {
    listCalls.push(page);
    return pageOneReads.shift()!;
  }, { maxPages: 1, maxRecords: 3 });

  const overflow = accumulateCappedRecordsById(accumulator, scan.records, () => true);

  assert.deepEqual(listCalls, [1, 1]);
  assert.equal(overflow.capped, true);
  assert.equal(overflow.attemptedUniqueCount, 3);
  assert.deepEqual([...accumulator.records.keys()], [completed.id]);
});

test('allows exactly the scan record cap when the next observed record is the baseline boundary', async () => {
  const listCalls: number[] = [];
  const scan = await scanBoundedRecords(async (page) => {
    listCalls.push(page);
    return { items: [completed, duplicate, baseline], total: 3, pageSize: 10 };
  }, {
    maxPages: 1,
    maxRecords: 2,
    isBoundary: (record) => record.id === baseline.id,
  });

  assert.deepEqual(listCalls, [1, 1]);
  assert.equal(scan.coverageComplete, true);
  assert.equal(scan.boundaryReached, true);
  assert.deepEqual(scan.records.map((record) => record.id), [completed.id, duplicate.id]);
});

test('propagates the scan cap plus one candidate into permanent cumulative terminal state', async () => {
  const listCalls: number[] = [];
  const scan = await scanBoundedRecords(async (page) => {
    listCalls.push(page);
    return { items: [completed, duplicate, thirdCandidate], total: 3, pageSize: 10 };
  }, { maxPages: 1, maxRecords: 2 });
  const accumulator = createCappedRecordAccumulator<FakeRecord>(2);
  const accumulation = accumulateCappedRecordsById(
    accumulator,
    scan.overflowRecord ? [...scan.records, scan.overflowRecord] : scan.records,
    () => true,
  );
  let evaluationCalls = 0;
  await mapAccumulatedRecords(accumulator, async () => {
    evaluationCalls++;
  });

  assert.deepEqual(listCalls, [1, 1]);
  assert.equal(scan.coverageComplete, false);
  assert.equal(accumulation.capped, true);
  assert.equal(accumulation.attemptedUniqueCount, 3);
  assert.equal(evaluationCalls, 0);
});
