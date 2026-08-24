import assert from 'node:assert/strict';
import test from 'node:test';

import { observeReadableStream } from '../lib/gateway/stream-observer.ts';

test('records the first non-empty client chunk and stream completion without changing bytes', async () => {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array());
      controller.enqueue(new TextEncoder().encode('hello'));
      controller.enqueue(new TextEncoder().encode(' world'));
      controller.close();
    },
  });
  const ticks = [125, 190];
  const observed = observeReadableStream(source, 100, () => ticks.shift() ?? 190);
  const chunks: Uint8Array[] = [];
  const reader = observed.stream.getReader();
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
  }

  assert.equal(new TextDecoder().decode(Buffer.concat(chunks)), 'hello world');
  assert.deepEqual(await observed.timing, { firstTokenMs: 25, durationMs: 90, cancelled: false });
});

test('settles timing and cancels the upstream reader when the client cancels', async () => {
  let cancelled = false;
  const source = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode('first'));
    },
    cancel() {
      cancelled = true;
    },
  });
  const ticks = [220, 260];
  const observed = observeReadableStream(source, 200, () => ticks.shift() ?? 260);
  const reader = observed.stream.getReader();
  await reader.read();
  await reader.cancel('client closed');

  assert.equal(cancelled, true);
  assert.deepEqual(await observed.timing, { firstTokenMs: 20, durationMs: 60, cancelled: true });
});
