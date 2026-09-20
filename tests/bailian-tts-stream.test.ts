import assert from 'node:assert/strict';
import test from 'node:test';
import { openBailianTtsStream, type WebSocketLike } from '../lib/vendors/bailian/tts-websocket.ts';
import { isUpstreamError } from '../lib/upstream-error.ts';

/**
 * 可编程的 WebSocket 替身。
 *
 * `script` 在收到 run-task 时被调用，拿到一个可以随时往回推事件的把手——
 * 这样才能表达「先给一片，等消费者读到了，再给下一片」这种真正的流式时序。
 */
interface Handle {
  binary(bytes: number[]): void;
  event(event: string, payload?: unknown, header?: Record<string, unknown>): void;
  closeSocket(): void;
  errorSocket(message?: string): void;
  closed(): boolean;
  sent(): any[];
}

function fakeSocket(script: (h: Handle) => void): { connect: () => WebSocketLike; handle: () => Handle } {
  let handle!: Handle;
  const connect = () => {
    const listeners: Record<string, ((e: any) => void)[]> = {};
    let closed = false;
    const sent: any[] = [];
    const emit = (type: string, e: any) => listeners[type]?.forEach((f) => f(e));

    handle = {
      binary: (bytes) => emit('message', { data: Uint8Array.from(bytes).buffer }),
      event: (event, payload, header) =>
        emit('message', { data: JSON.stringify({ header: { event, ...header }, payload }) }),
      closeSocket: () => emit('close', {}),
      errorSocket: (message) => emit('error', { message }),
      closed: () => closed,
      sent: () => sent,
    };

    const socket: WebSocketLike = {
      send: (data: string) => {
        const msg = JSON.parse(data);
        sent.push(msg);
        if (msg.header.action === 'run-task') queueMicrotask(() => script(handle));
      },
      close: () => { closed = true; },
      addEventListener: (type, fn) => {
        (listeners[type] ??= []).push(fn);
        if (type === 'open') queueMicrotask(() => fn({}));
      },
    };
    return socket;
  };
  return { connect, handle: () => handle };
}

const open = (connect: () => WebSocketLike, extra: Record<string, unknown> = {}) =>
  openBailianTtsStream(null, 'sk-test', { model: 'cosyvoice-v3-flash', text: '你好', connect, ...extra }, 3_000);

test('audio is delivered incrementally, not buffered until the end', async () => {
  // 上游只有在消费者确实读到第一片之后才发第二片。
  // 如果实现退回成「收齐再给」，这里会卡死到超时。
  let h!: Handle;
  const { connect } = fakeSocket((handle) => { h = handle; handle.binary([1, 1]); });
  const stream = await open(connect);

  const got: number[] = [];
  const iterator = stream.chunks[Symbol.asyncIterator]();

  const first = await iterator.next();
  got.push(...(first.value as Uint8Array));
  assert.deepEqual(got, [1, 1], '第一片必须在上游结束之前就能拿到');

  h.binary([2, 2]);
  const second = await iterator.next();
  got.push(...(second.value as Uint8Array));

  h.event('task-finished', { usage: { characters: 4 } });
  const third = await iterator.next();
  assert.equal(third.done, true);
  assert.deepEqual(got, [1, 1, 2, 2]);
});

test('the character count survives after the audio bytes are gone', async () => {
  const { connect } = fakeSocket((h) => {
    h.binary([1]);
    h.event('task-finished', { usage: { characters: 42 } }, { task_id: 'task-abc' });
  });
  const stream = await open(connect);
  for await (const _ of stream.chunks) { /* 全部读走 */ }

  // 字符数只有 task-finished 才知道，那时字节早发出去了——所以必须走旁路。
  const done = await stream.completion;
  assert.equal(done.reason, 'finished');
  assert.equal(done.characters, 42);
  assert.equal(done.requestId, 'task-abc');
});

test('a mid-stream task-failed delivers what arrived, then throws with the hint', async () => {
  const { connect } = fakeSocket((h) => {
    h.binary([5, 5]);
    h.event('task-failed', undefined, {
      error_code: 'InvalidParameter',
      error_message: 'Engine return error code: 418',
    });
  });
  const stream = await openBailianTtsStream(
    null,
    'sk-test',
    { model: 'cosyvoice-v2', text: '你好', voice: 'Cherry', connect },
    3_000,
  );

  const got: number[] = [];
  let thrown: unknown;
  try {
    for await (const chunk of stream.chunks) got.push(...chunk);
  } catch (e) {
    thrown = e;
  }

  assert.deepEqual(got, [5, 5], '报错之前收到的音频照样交付');
  assert.ok(isUpstreamError(thrown));
  assert.equal((thrown as any).status, 400);
  assert.match((thrown as any).message, /418 表示音色与模型不匹配/);

  // completion 永不 reject——日志的 after() 在等它。
  const done = await stream.completion;
  assert.equal(done.reason, 'failed');
});

test('a voice rejected before any audio becomes a plain HTTP error, not an empty 200', async () => {
  const { connect } = fakeSocket((h) => {
    h.event('task-failed', undefined, {
      error_code: 'InvalidParameter',
      error_message: '[cosyvoice:]Engine error [411]',
    });
  });
  // 一个字节都还没出，这时还来得及变成 4xx。
  await assert.rejects(
    () => openBailianTtsStream(null, 'sk-test', { model: 'qwen-audio-3.0-tts-flash', text: '你好', voice: 'Cherry', connect }, 3_000),
    (e: unknown) => isUpstreamError(e) && (e as any).status === 400 && /longanlingxi/.test((e as any).message),
  );
});

test('a consumer that walks away closes the upstream socket', async () => {
  const { connect, handle } = fakeSocket((h) => { h.binary([1]); });
  const stream = await open(connect);

  for await (const _ of stream.chunks) break;
  await stream.chunks.return(undefined);

  const done = await stream.completion;
  assert.equal(done.reason, 'cancelled');
  // 不关就是继续合成、继续计费。
  assert.equal(handle().closed(), true);
});

test('aborting mid-stream stops the socket and surfaces 499', async () => {
  const controller = new AbortController();
  const { connect, handle } = fakeSocket((h) => { h.binary([1]); });
  const stream = await open(connect, { signal: controller.signal });

  const iterator = stream.chunks[Symbol.asyncIterator]();
  await iterator.next();
  controller.abort();

  await assert.rejects(() => iterator.next(), (e: unknown) => isUpstreamError(e) && (e as any).status === 499);
  assert.equal(handle().closed(), true);
  assert.equal((await stream.completion).reason, 'cancelled');
});

test('closing without task-finished is reported as truncated, not as success', async () => {
  const { connect } = fakeSocket((h) => {
    h.binary([1, 2, 3]);
    h.closeSocket();
  });
  const stream = await open(connect);

  const got: number[] = [];
  for await (const chunk of stream.chunks) got.push(...chunk);
  assert.deepEqual(got, [1, 2, 3]);

  // 此前这条路径记 200 且无声截断；现在它在日志里有名字。
  assert.equal((await stream.completion).reason, 'truncated');
});

test('a binary frame racing task-finished in the same microtask is not lost', async () => {
  const { connect } = fakeSocket((h) => {
    // 二进制帧转 Buffer 是异步的，task-finished 是同步的——不串起来就丢尾音。
    h.binary([7]);
    h.event('task-finished', { usage: { characters: 1 } });
  });
  const stream = await open(connect);
  const got: number[] = [];
  for await (const chunk of stream.chunks) got.push(...chunk);
  assert.deepEqual(got, [7]);
});

test('completion always settles, whatever the socket does', async () => {
  // 终止事件一律在第一片之后才触发——那正是「已经 200 了、只能中断流」的处境，
  // 也是 completion 悬挂唯一会造成真实泄漏的处境。
  const endings: Array<[string, (h: Handle) => void]> = [
    ['finished', (h) => h.event('task-finished')],
    ['task-failed', (h) => h.event('task-failed', undefined, { error_message: 'x' })],
    ['socket-error', (h) => h.errorSocket('boom')],
    ['close-early', (h) => h.closeSocket()],
    ['consumer-cancel', () => { /* 下面直接 return 迭代器 */ }],
  ];

  for (const [name, ending] of endings) {
    let h!: Handle;
    const { connect } = fakeSocket((handle) => { h = handle; handle.binary([1]); });
    const stream = await open(connect);
    const iterator = stream.chunks[Symbol.asyncIterator]();
    await iterator.next();

    if (name === 'consumer-cancel') {
      await iterator.return(undefined);
    } else {
      ending(h);
      try {
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
        }
      } catch { /* 允许抛 */ }
    }

    const raced = await Promise.race([
      stream.completion.then(() => 'settled'),
      new Promise((r) => setTimeout(() => r('HUNG'), 80)),
    ]);
    assert.equal(raced, 'settled', `${name}: completion 悬挂会让日志的 after() 永久挂住`);
  }
});

test('a "successful" synthesis with zero audio becomes an error, not an empty 200', async () => {
  // 实测：自定义音色还在 DEPLOYING 时，上游会回 task-finished 却一个字节都不给。
  // 放过去，客户端拿到的就是一个 200 的空音频，什么也听不出来、也无从排查。
  const { connect } = fakeSocket((h) => h.event('task-finished', { usage: { characters: 4 } }));
  await assert.rejects(
    () => open(connect),
    (e: unknown) => isUpstreamError(e) && (e as any).status === 502 && /DEPLOYING/.test((e as any).message),
  );
});
