import assert from 'node:assert/strict';
import test from 'node:test';

import { runTargetAttempts } from '../lib/gateway/target-attempt-runner.ts';

type Target = { id: string };
type Endpoint = { id: string };

function harness(statuses: Record<string, number | 'stream'>, unavailable = new Set<string>()) {
  const targets: Target[] = [{ id: 'a' }, { id: 'b' }];
  const selections: string[] = [];
  const fetches: string[] = [];
  const unavailableLogs: Array<{ id: string; continue: boolean }> = [];
  const failureLogs: Array<{ id: string; continue: boolean; status: number }> = [];
  const result = runTargetAttempts<Target, Endpoint, string, { status: number }>({
    targets,
    selectEndpoint(target) {
      selections.push(target.id);
      return unavailable.has(target.id) ? undefined : { id: `${target.id}-endpoint` };
    },
    async execute(target) {
      fetches.push(target.id);
      const status = statuses[target.id] ?? 200;
      if (status === 'stream') return { ok: true, value: `stream:${target.id}` };
      return status >= 200 && status < 300
        ? { ok: true, value: `ok:${target.id}` }
        : { ok: false, status, value: `error:${target.id}`, context: { status } };
    },
    targetLabel: (target) => target.id,
    onUnavailable: (target, willContinue) => { unavailableLogs.push({ id: target.id, continue: willContinue }); },
    unavailableError: (target) => new Error(`unavailable:${target.id}`),
    onFailure: (target, failure, willContinue) => { failureLogs.push({ id: target.id, continue: willContinue, status: failure.status }); },
  });
  return { result, selections, fetches, unavailableLogs, failureLogs };
}

for (const status of [400, 404]) {
  test(`upstream ${status} performs one fetch and never switches endpoint or provider`, async () => {
    const run = harness({ a: status, b: 200 });
    assert.equal(await run.result, 'error:a');
    assert.deepEqual(run.selections, ['a']);
    assert.deepEqual(run.fetches, ['a']);
    assert.deepEqual(run.failureLogs, [{ id: 'a', continue: false, status }]);
  });
}

for (const status of [429, 500]) {
  test(`upstream ${status} fails over only to the next provider target`, async () => {
    const run = harness({ a: status, b: 200 });
    assert.equal(await run.result, 'ok:b');
    assert.deepEqual(run.selections, ['a', 'b']);
    assert.deepEqual(run.fetches, ['a', 'b']);
    assert.deepEqual(run.failureLogs, [{ id: 'a', continue: true, status }]);
  });
}

test('an unavailable endpoint records provider-local 503 and continues to the next alias provider', async () => {
  const run = harness({ b: 200 }, new Set(['a']));
  assert.equal(await run.result, 'ok:b');
  assert.deepEqual(run.selections, ['a', 'b']);
  assert.deepEqual(run.fetches, ['b']);
  assert.deepEqual(run.unavailableLogs, [{ id: 'a', continue: true }]);
});

test('the final unavailable target throws only after prior provider failures', async () => {
  const run = harness({}, new Set(['a', 'b']));
  await assert.rejects(run.result, /unavailable:b/);
  assert.deepEqual(run.unavailableLogs, [
    { id: 'a', continue: true },
    { id: 'b', continue: false },
  ]);
  assert.deepEqual(run.fetches, []);
});

test('a stream established on the first provider is terminal and never fails over', async () => {
  const run = harness({ a: 'stream', b: 200 });
  assert.equal(await run.result, 'stream:a');
  assert.deepEqual(run.selections, ['a']);
  assert.deepEqual(run.fetches, ['a']);
});

test('a local conversion failure after upstream success never fails over', async () => {
  const selections: string[] = [];
  const executions: string[] = [];
  const activeDiagnostics: Array<{ target: string; endpoint: string }> = [];
  await assert.rejects(runTargetAttempts({
    targets: [{ id: 'a' }, { id: 'b' }],
    selectEndpoint(target) { selections.push(target.id); return { id: `${target.id}-endpoint` }; },
    onSelected(target, endpoint) { activeDiagnostics.push({ target: target.id, endpoint: endpoint.id }); },
    async execute(target) { executions.push(target.id); throw new Error('local conversion failed'); },
    targetLabel: (target) => target.id,
    onUnavailable() {},
    unavailableError: () => new Error('unavailable'),
    onFailure() {},
  }), /local conversion failed/);
  assert.deepEqual(selections, ['a']);
  assert.deepEqual(executions, ['a']);
  assert.deepEqual(activeDiagnostics, [{ target: 'a', endpoint: 'a-endpoint' }]);
});
