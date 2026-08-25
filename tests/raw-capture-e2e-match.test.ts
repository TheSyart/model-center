import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateExactOnceCapture,
  type CaptureCandidateObservation,
} from './raw-capture-e2e-match.ts';

const completed: CaptureCandidateObservation = {
  id: '11111111-1111-4111-8111-111111111111',
  complete: true,
  status: 200,
  stream: false,
  request: { state: 'exact' },
  response: { state: 'not_checked' },
};

test('does not report success when an incomplete duplicate has identical request bytes', () => {
  const incompleteDuplicate: CaptureCandidateObservation = {
    id: '22222222-2222-4222-8222-222222222222',
    complete: false,
    status: null,
    stream: false,
    request: { state: 'exact' },
    response: { state: 'not_checked' },
  };

  const result = evaluateExactOnceCapture(
    [completed, incompleteDuplicate],
    { status: 200, stream: false, requireResponse: false },
  );

  assert.equal(result.ready, false);
  assert.deepEqual(result.exactRequestIds, [completed.id, incompleteDuplicate.id]);
  assert.match(result.diagnostic, new RegExp(`id=${completed.id} complete=true status=200`));
  assert.match(result.diagnostic, new RegExp(`id=${incompleteDuplicate.id} complete=false status=null`));
});

test('allows one exact request while tolerating an unrelated concurrent record', () => {
  const unrelated: CaptureCandidateObservation = {
    id: '33333333-3333-4333-8333-333333333333',
    complete: false,
    status: null,
    stream: false,
    request: { state: 'different' },
    response: { state: 'not_checked' },
  };

  const result = evaluateExactOnceCapture(
    [completed, unrelated],
    { status: 200, stream: false, requireResponse: false },
  );

  assert.equal(result.ready, true);
  assert.deepEqual(result.exactRequestIds, [completed.id]);
});

test('keeps safe request and response download failure states in diagnostics', () => {
  const requestFailure: CaptureCandidateObservation = {
    ...completed,
    id: '44444444-4444-4444-8444-444444444444',
    request: { state: 'error', reason: 'http_error', status: 410 },
  };
  const responseFailure: CaptureCandidateObservation = {
    ...completed,
    id: '55555555-5555-4555-8555-555555555555',
    stream: true,
    response: { state: 'error', reason: 'read_error' },
  };

  const result = evaluateExactOnceCapture(
    [requestFailure, responseFailure],
    { status: 200, stream: true, requireResponse: true },
  );

  assert.equal(result.ready, false);
  assert.match(result.diagnostic, /request=error:http_error:410/);
  assert.match(result.diagnostic, /response=error:read_error/);
});
