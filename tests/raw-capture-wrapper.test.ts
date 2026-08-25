import assert from 'node:assert/strict';
import test from 'node:test';

import {
  withRawCapture,
  type RawCaptureDependencies,
  type RawCaptureRouteHandler,
} from '../lib/raw-capture/capture.ts';
import type { RawCaptureRecord, RawCaptureSession } from '../lib/raw-capture/types.ts';

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
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
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function request(path: string, body: string, headers?: HeadersInit): Request {
  return new Request(`http://localhost${path}`, { method: 'POST', body, headers });
}

function initialRecord(): RawCaptureRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    day: '2026-08-26',
    startedAt: 1,
    completedAt: null,
    path: '/v1/messages',
    entryProtocol: 'anthropic',
    status: null,
    stream: false,
    contentType: null,
    requestBytes: 0,
    responseBytes: 0,
    complete: false,
    captureError: null,
    location: 'active',
  };
}

function harness(enabled: boolean) {
  const responseChunks: Uint8Array[] = [];
  const finished = deferred<void>();
  const failed = deferred<void>();
  const state: {
    beginCalls: number;
    archiveCalls: number;
    beginInput?: {
      entryProtocol: 'openai' | 'anthropic' | 'responses' | 'security-lab-anthropic';
      path: string;
      requestBody: Uint8Array;
    };
    finishInput?: Parameters<RawCaptureSession['finish']>[0];
    failMessage?: string;
  } = { beginCalls: 0, archiveCalls: 0 };

  const session: RawCaptureSession = {
    record: initialRecord(),
    async appendResponse(chunk) {
      responseChunks.push(chunk.slice());
    },
    async finish(input) {
      state.finishInput = input;
      finished.resolve();
      return { ...this.record, ...input, completedAt: 2 };
    },
    async fail(message) {
      state.failMessage = message;
      failed.resolve();
      return { ...this.record, completedAt: 2, complete: false, captureError: message };
    },
  };

  const dependencies: RawCaptureDependencies = {
    getEnabled: () => enabled,
    createStore: () => ({
      async beginRecord(input) {
        state.beginCalls++;
        state.beginInput = { ...input, requestBody: input.requestBody.slice() };
        return session;
      },
    }),
    triggerArchiveCheck: () => {
      state.archiveCalls++;
    },
  };

  return { dependencies, failed, finished, responseChunks, session, state };
}

test('disabled wrapper passes the original request and response through without cloning or store access', async () => {
  const capture = harness(false);
  const originalRequest = request('/v1/messages', '{"model":"x"}');
  let cloneCalls = 0;
  Object.defineProperty(originalRequest, 'clone', {
    value() {
      cloneCalls++;
      throw new Error('disabled capture cloned the request');
    },
  });
  const originalResponse = new Response('ok', { status: 201 });
  const handler: RawCaptureRouteHandler = (seen) => {
    assert.equal(seen, originalRequest);
    return originalResponse;
  };

  const response = await withRawCapture(
    { entry: 'anthropic', path: '/v1/messages' },
    handler,
    capture.dependencies,
  )(originalRequest as never);

  assert.equal(response, originalResponse);
  assert.equal(cloneCalls, 0);
  assert.equal(capture.state.beginCalls, 0);
  assert.equal(capture.state.archiveCalls, 0);
});

test('enabled wrapper stores exact request and final response bytes while preserving response semantics', async () => {
  const capture = harness(true);
  const raw = '{  "model":"x", "messages":[{"role":"user","content":"你好"}] }\n';
  const responseBody = 'data: 原样\n\n';
  const originalRequest = request('/v1/messages', raw);
  const response = await withRawCapture(
    { entry: 'anthropic', path: '/v1/messages' },
    async (seen) => {
      assert.equal(seen, originalRequest);
      assert.equal(await seen.text(), raw);
      return new Response(responseBody, {
        status: 207,
        statusText: 'Captured Upstream',
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'x-upstream-header': 'preserved',
        },
      });
    },
    capture.dependencies,
  )(originalRequest as never);

  assert.equal(response.status, 207);
  assert.equal(response.statusText, 'Captured Upstream');
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.equal(response.headers.get('x-upstream-header'), 'preserved');
  assert.deepEqual(await readAll(response.body!), bytes(responseBody));
  await capture.finished.promise;

  assert.deepEqual(capture.state.beginInput, {
    entryProtocol: 'anthropic',
    path: '/v1/messages',
    requestBody: bytes(raw),
  });
  assert.deepEqual(concat(capture.responseChunks), bytes(responseBody));
  assert.deepEqual(capture.state.finishInput, {
    status: 207,
    stream: true,
    contentType: 'text/event-stream; charset=utf-8',
    complete: true,
    captureError: null,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(capture.state.archiveCalls, 1);
});

test('captures a 401 response without reading or persisting request headers', async () => {
  const capture = harness(true);
  const secret = 'secret-key-must-not-be-metadata';
  const originalRequest = request('/v1/messages', '{"model":"x"}', {
    authorization: `Bearer ${secret}`,
    'x-api-key': secret,
    cookie: `session=${secret}`,
  });

  const response = await withRawCapture(
    { entry: 'anthropic', path: '/v1/messages' },
    async () => new Response('{"type":"error"}', {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }),
    capture.dependencies,
  )(originalRequest as never);

  await response.arrayBuffer();
  await capture.finished.promise;
  const persistedMetadata = JSON.stringify({
    begin: capture.state.beginInput,
    finish: capture.state.finishInput,
  });
  assert.equal(response.status, 401);
  assert.equal(persistedMetadata.includes(secret), false);
  assert.deepEqual(capture.state.finishInput, {
    status: 401,
    stream: false,
    contentType: 'application/json',
    complete: true,
    captureError: null,
  });
});

test('records a thrown handler as failed and rethrows the original error unchanged', async () => {
  const capture = harness(true);
  const handlerError = new Error('handler exploded');
  capture.session.fail = async (message) => {
    capture.state.failMessage = message;
    capture.failed.resolve();
    throw new Error('metadata also failed');
  };

  await assert.rejects(async () => {
    await withRawCapture(
      { entry: 'anthropic', path: '/v1/messages' },
      async () => { throw handlerError; },
      capture.dependencies,
    )(request('/v1/messages', '{}') as never);
  }, (error: unknown) => error === handlerError);
  await capture.failed.promise;
  assert.match(capture.state.failMessage ?? '', /handler exploded/);
});

test('finishes an empty response without replacing the original Response object', async () => {
  const capture = harness(true);
  const originalResponse = new Response(null, {
    status: 204,
    statusText: 'No Content',
    headers: { 'x-empty': 'yes' },
  });

  const response = await withRawCapture(
    { entry: 'responses', path: '/v1/responses' },
    async () => originalResponse,
    capture.dependencies,
  )(request('/v1/responses', '{}') as never);

  assert.equal(response, originalResponse);
  assert.deepEqual(capture.state.finishInput, {
    status: 204,
    stream: false,
    contentType: null,
    complete: true,
    captureError: null,
  });
  assert.deepEqual(capture.responseChunks, []);
});

test('capture setup and archive failures never prevent the original handler response', async () => {
  const capture = harness(true);
  let archiveAttempted = false;
  capture.dependencies.createStore = () => { throw new Error('disk unavailable'); };
  capture.dependencies.triggerArchiveCheck = async () => {
    archiveAttempted = true;
    throw new Error('archive unavailable');
  };
  const originalRequest = request('/v1/messages', '{"model":"x"}');
  const originalResponse = new Response('still works');

  const response = await withRawCapture(
    { entry: 'anthropic', path: '/v1/messages' },
    async (seen) => {
      assert.equal(seen, originalRequest);
      return originalResponse;
    },
    capture.dependencies,
  )(originalRequest as never);

  assert.equal(response, originalResponse);
  assert.equal(await response.text(), 'still works');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(archiveAttempted, true);
});

test('client cancellation reaches upstream and finalizes the record as incomplete', async () => {
  const capture = harness(true);
  let cancelledWith: unknown;
  let sent = false;
  const upstream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) return;
      sent = true;
      controller.enqueue(bytes('partial'));
    },
    cancel(reason) {
      cancelledWith = reason;
    },
  });
  const response = await withRawCapture(
    { entry: 'openai', path: '/v1/chat/completions' },
    async () => new Response(upstream, {
      headers: { 'content-type': 'text/event-stream' },
    }),
    capture.dependencies,
  )(request('/v1/chat/completions', '{}') as never);
  const reader = response.body!.getReader();
  assert.deepEqual((await reader.read()).value, bytes('partial'));

  await reader.cancel('viewer-left');
  await capture.finished.promise;

  assert.equal(cancelledWith, 'viewer-left');
  assert.equal(capture.state.finishInput?.complete, false);
});
