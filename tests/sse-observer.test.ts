import assert from 'node:assert/strict';
import test from 'node:test';

import { observeSSEStream } from '../lib/protocols/sse.ts';

const encoder = new TextEncoder();

test('observes SSE events without eagerly draining a slow client stream', async () => {
  const payloads = [
    'event: message_start\r\ndata: {"type":"message_start"}\r\n\r\n',
    'data: {"delta":"one"}\n\n',
    'data: {"delta":"two"}\n\n',
    'data: [DONE]\n\n',
  ];
  let pulls = 0;
  const source = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulls < payloads.length) controller.enqueue(encoder.encode(payloads[pulls]));
      pulls += 1;
      if (pulls > payloads.length) controller.close();
    },
  });
  const events: Array<{ event: string | null; data: string }> = [];
  const observed = observeSSEStream(source, (event) => events.push(event));

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(pulls < payloads.length, 'the observer must not drain the source before the client reads');

  const chunks: Uint8Array[] = [];
  const reader = observed.stream.getReader();
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
  }
  await observed.done;

  assert.equal(new TextDecoder().decode(Buffer.concat(chunks)), payloads.join(''));
  assert.deepEqual(events, [
    { event: 'message_start', data: '{"type":"message_start"}' },
    { event: null, data: '{"delta":"one"}' },
    { event: null, data: '{"delta":"two"}' },
    { event: null, data: '[DONE]' },
  ]);
});

test('client cancellation propagates upstream and settles the observer', async () => {
  let cancelled = false;
  const source = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(encoder.encode('data: {"partial":true}\n\n'));
    },
    cancel() {
      cancelled = true;
    },
  });
  const events: string[] = [];
  const observed = observeSSEStream(source, (event) => events.push(event.data));
  const reader = observed.stream.getReader();

  await reader.read();
  await reader.cancel('client closed');
  await observed.done;

  assert.equal(cancelled, true);
  assert.deepEqual(events, ['{"partial":true}']);
});

test('disables metric parsing after an oversized malformed event while preserving bytes', async () => {
  const malformed = 'x'.repeat(1024 * 1024 + 1);
  const validAfterLimit = '\ndata: {"should":"not-parse"}\n\n';
  const expected = malformed + validAfterLimit;
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(malformed));
      controller.enqueue(encoder.encode(validAfterLimit));
      controller.close();
    },
  });
  const events: string[] = [];
  const observed = observeSSEStream(source, (event) => events.push(event.data));
  const chunks: Uint8Array[] = [];
  const reader = observed.stream.getReader();
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
  }
  await observed.done;

  assert.equal(new TextDecoder().decode(Buffer.concat(chunks)), expected);
  assert.deepEqual(events, []);
});
