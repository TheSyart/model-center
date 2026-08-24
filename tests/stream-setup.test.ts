import assert from 'node:assert/strict';
import test from 'node:test';

import { runStreamSetupSafely } from '../lib/gateway/stream-setup.ts';

test('stream setup failure cancels the tracked stream and always cleans up forwarding resources', async () => {
  let cancelledWith: unknown;
  let cleanups = 0;
  const upstream = new ReadableStream<Uint8Array>({
    cancel(reason) { cancelledWith = reason; },
  });
  const failure = new Error('translate setup failed');

  await assert.rejects(
    runStreamSetupSafely(upstream, () => { cleanups++; }, () => { throw failure; }),
    /translate setup failed/,
  );

  assert.equal(cancelledWith, failure);
  assert.equal(cleanups, 1);
});

test('stream setup failure cancels the latest adapter stream and observes abandoned usage rejection', async () => {
  let adapterCancelled = false;
  let cleanups = 0;
  const upstream = new ReadableStream<Uint8Array>();
  const adapterStream = new ReadableStream<Uint8Array>({ cancel() { adapterCancelled = true; } });

  await assert.rejects(
    runStreamSetupSafely(upstream, () => { cleanups++; }, (track) => {
      track.stream(adapterStream);
      track.usage(Promise.reject(new Error('abandoned usage')));
      throw new Error('egress setup failed');
    }),
    /egress setup failed/,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(adapterCancelled, true);
  assert.equal(cleanups, 1);
});
