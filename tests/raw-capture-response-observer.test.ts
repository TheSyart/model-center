import assert from 'node:assert/strict';
import test from 'node:test';

import {
  observeResponseBody,
  type ResponseCaptureResult,
  type ResponseCaptureSink,
} from '../lib/raw-capture/response-observer.ts';

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const result = await reader.read();
    if (result.done) return concat(chunks);
    chunks.push(result.value);
  }
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

async function within<T>(promise: Promise<T>, milliseconds = 1_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${milliseconds}ms`)), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

test('returns exactly the input bytes and records copied chunks in order', async () => {
  const inputChunks = [bytes('event: a\n\n'), bytes('data: 世界\n\n')];
  const expected = concat(inputChunks);
  const recorded: Uint8Array[] = [];
  let closedWith: ResponseCaptureResult | undefined;
  let failures = 0;
  const observed = observeResponseBody(streamOf(inputChunks), {
    async write(chunk) { recorded.push(chunk.slice()); },
    async close(result) { closedWith = result; },
    async fail() { failures++; },
  });

  assert.deepEqual(await readAll(observed.stream), expected);
  const result = await observed.done;

  assert.deepEqual(concat(recorded), expected);
  assert.deepEqual(result, { complete: true, responseBytes: expected.byteLength, captureError: null });
  assert.deepEqual(closedWith, result);
  assert.equal(failures, 0);
});

test('slow capture writes do not block client delivery while the queue is within its bound', async () => {
  const gate = deferred<void>();
  const writes: string[] = [];
  const observed = observeResponseBody(streamOf([bytes('1234'), bytes('5678')]), {
    async write(chunk) {
      writes.push(new TextDecoder().decode(chunk));
      await gate.promise;
    },
    async close() {},
    async fail() {},
  }, { maxBufferedBytes: 8 });
  let captureSettled = false;
  void observed.done.then(() => { captureSettled = true; });

  const clientBytes = await within(readAll(observed.stream));

  assert.equal(new TextDecoder().decode(clientBytes), '12345678');
  assert.equal(captureSettled, false);
  gate.resolve();
  assert.deepEqual(await observed.done, { complete: true, responseBytes: 8, captureError: null });
  assert.deepEqual(writes, ['1234', '5678']);
});

test('client cancellation cancels upstream first and finalizes as incomplete after queued writes', async () => {
  const writeStarted = deferred<void>();
  const writeGate = deferred<void>();
  const events: string[] = [];
  let sent = false;
  const input = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) return;
      sent = true;
      controller.enqueue(bytes('first'));
    },
    cancel(reason) {
      events.push(`upstream-cancel:${String(reason)}`);
    },
  });
  const sink: ResponseCaptureSink = {
    async write() {
      events.push('write-start');
      writeStarted.resolve();
      await writeGate.promise;
      events.push('write-end');
    },
    async close(result) { events.push(`close:${result.complete}`); },
    async fail() { events.push('fail'); },
  };
  const observed = observeResponseBody(input, sink);
  const reader = observed.stream.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'first');
  await writeStarted.promise;

  let cancelSettled = false;
  const cancellation = reader.cancel('stop').then(() => { cancelSettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(events.includes('upstream-cancel:stop'), true);
  assert.equal(cancelSettled, false);
  writeGate.resolve();
  await cancellation;
  assert.deepEqual(await observed.done, { complete: false, responseBytes: 5, captureError: null });
  assert.deepEqual(events, ['write-start', 'upstream-cancel:stop', 'write-end', 'close:false']);
});

test('bounded queue abandons capture but keeps client bytes flowing', async () => {
  const gate = deferred<void>();
  let writes = 0;
  let failures = 0;
  let closedWith: ResponseCaptureResult | undefined;
  const observed = observeResponseBody(streamOf([bytes('1234'), bytes('5678')]), {
    async write() {
      writes++;
      await gate.promise;
    },
    async close(result) { closedWith = result; },
    async fail() { failures++; },
  }, { maxBufferedBytes: 4 });

  assert.equal(new TextDecoder().decode(await within(readAll(observed.stream))), '12345678');
  gate.resolve();
  const result = await observed.done;

  assert.equal(result.complete, false);
  assert.equal(result.responseBytes, 4);
  assert.match(result.captureError ?? '', /缓冲上限/);
  assert.equal(writes, 1);
  assert.equal(failures, 0);
  assert.deepEqual(closedWith, result);
});

test('zero-byte chunks do not create unbounded capture queue entries', async () => {
  let writes = 0;
  const observed = observeResponseBody(streamOf([
    new Uint8Array(),
    new Uint8Array(),
    new Uint8Array(),
    bytes('client'),
  ]), {
    async write() { writes++; },
    async close() {},
    async fail() {},
  }, { maxBufferedBytes: 0 });

  assert.equal(new TextDecoder().decode(await readAll(observed.stream)), 'client');
  const result = await observed.done;

  assert.equal(writes, 0);
  assert.equal(result.responseBytes, 0);
  assert.match(result.captureError ?? '', /缓冲上限/);
});

test('capture write and fail errors are swallowed while all client bytes continue', async () => {
  const diskError = new Error('disk full');
  let writes = 0;
  let failures = 0;
  let closes = 0;
  const observed = observeResponseBody(streamOf([bytes('first'), bytes('second')]), {
    async write() {
      writes++;
      throw diskError;
    },
    async close() { closes++; },
    async fail(error) {
      failures++;
      assert.equal(error, diskError);
      throw new Error('metadata write also failed');
    },
  });

  assert.equal(new TextDecoder().decode(await readAll(observed.stream)), 'firstsecond');
  const result = await observed.done;

  assert.equal(result.complete, false);
  assert.equal(result.responseBytes, 0);
  assert.match(result.captureError ?? '', /disk full/);
  assert.equal(writes, 1);
  assert.equal(failures, 1);
  assert.equal(closes, 0);
});

test('upstream stream errors reach the client and settle capture exactly once as incomplete', async () => {
  const streamError = new Error('upstream broke');
  let pulls = 0;
  let closes = 0;
  let failures = 0;
  const input = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      if (pulls === 1) controller.enqueue(bytes('partial'));
      else controller.error(streamError);
    },
  });
  const observed = observeResponseBody(input, {
    async write() {},
    async close() { closes++; },
    async fail() { failures++; },
  });

  await assert.rejects(readAll(observed.stream), (error) => error === streamError);
  const result = await observed.done;

  assert.equal(result.complete, false);
  assert.equal(result.responseBytes, 7);
  assert.match(result.captureError ?? '', /upstream broke/);
  assert.equal(closes, 1);
  assert.equal(failures, 0);
});
