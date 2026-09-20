import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bailianRealtimeTtsUrl,
  buildRealtimeSession,
  openBailianRealtimeTtsStream,
  realtimeErrorStatus,
} from '../lib/vendors/bailian/realtime-tts.ts';
import type { WebSocketLike } from '../lib/vendors/bailian/ws-transport.ts';
import { isUpstreamError } from '../lib/upstream-error.ts';

interface Handle {
  json(payload: Record<string, unknown>): void;
  audio(bytes: number[]): void;
  binary(bytes: number[]): void;
  closeSocket(): void;
  sent(): any[];
  closed(): boolean;
}

/** 连上之后服务端先推 session.created，这是实测的真实顺序。 */
function fakeRealtime(script: (h: Handle) => void): { connect: (url: string) => WebSocketLike; url: () => string; handle: () => Handle } {
  let handle!: Handle;
  let seenUrl = '';
  const connect = (url: string) => {
    seenUrl = url;
    const listeners: Record<string, ((e: any) => void)[]> = {};
    const sent: any[] = [];
    let closed = false;
    const emit = (type: string, e: any) => listeners[type]?.forEach((f) => f(e));

    handle = {
      json: (payload) => emit('message', { data: JSON.stringify(payload) }),
      audio: (bytes) =>
        emit('message', {
          data: JSON.stringify({ type: 'response.audio.delta', delta: Buffer.from(Uint8Array.from(bytes)).toString('base64') }),
        }),
      binary: (bytes) => emit('message', { data: Uint8Array.from(bytes).buffer }),
      closeSocket: () => emit('close', {}),
      sent: () => sent,
      closed: () => closed,
    };

    const socket: WebSocketLike = {
      send: (data: string) => {
        const msg = JSON.parse(data);
        sent.push(msg);
        if (msg.type === 'session.finish') queueMicrotask(() => script(handle));
      },
      close: () => { closed = true; },
      addEventListener: (type, fn) => {
        (listeners[type] ??= []).push(fn);
        if (type === 'message') queueMicrotask(() => fn({ data: JSON.stringify({ type: 'session.created', session: { id: 'sess-1' } }) }));
      },
    };
    return socket;
  };
  return { connect, url: () => seenUrl, handle: () => handle };
}

const open = (connect: (url: string) => WebSocketLike, extra: Record<string, unknown> = {}) =>
  openBailianRealtimeTtsStream(null, 'sk-test', {
    model: 'qwen3-tts-flash-realtime',
    text: '你好',
    voice: 'Cherry',
    connect,
    ...extra,
  }, 3_000);

test('the model goes in the URL query, not in the message body', () => {
  // 放错位置的表现是完全不出音，不是报错。
  assert.equal(
    bailianRealtimeTtsUrl(null, 'qwen3-tts-flash-realtime'),
    'wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-tts-flash-realtime',
  );
  assert.equal(
    bailianRealtimeTtsUrl('llm-abc', 'qwen3-tts-flash-realtime'),
    'wss://llm-abc.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=qwen3-tts-flash-realtime',
  );
});

test('the session payload uses protocol B field names, not protocol A ones', () => {
  const session = buildRealtimeSession({
    voice: 'Cherry',
    speechRate: 1.2,
    pitchRate: 0.9,
    volume: 70,
    bitRate: 64,
    languageType: 'Chinese',
    instructions: '温柔一点',
    optimizeInstructions: true,
  });
  // 协议 A 叫 rate / pitch / format；这里全是另一套名字，混用不会报错、只是不生效。
  assert.deepEqual(session, {
    voice: 'Cherry',
    mode: 'server_commit',
    language_type: 'Chinese',
    response_format: 'pcm',
    sample_rate: 24000,
    speech_rate: 1.2,
    volume: 70,
    pitch_rate: 0.9,
    bit_rate: 64,
    instructions: '温柔一点',
    optimize_instructions: true,
  });
});

test('session.update waits for session.created, then text is appended and committed', async () => {
  const { connect, handle } = fakeRealtime((h) => {
    h.audio([1, 2, 3]);
    h.json({ type: 'session.finished' });
  });
  const stream = await open(connect);
  for await (const _ of stream.chunks) { /* 排空 */ }

  const types = handle().sent().map((m) => m.type);
  assert.deepEqual(types, ['session.update', 'input_text_buffer.append', 'input_text_buffer.commit', 'session.finish']);
  assert.equal(handle().sent()[1].text, '你好');
});

test('audio arrives as base64 in response.audio.delta', async () => {
  const { connect } = fakeRealtime((h) => {
    h.audio([10, 20, 30]);
    h.json({ type: 'response.done', response: { usage: { characters: 2, total_tokens: 67 } } });
    h.json({ type: 'session.finished' });
  });
  const stream = await open(connect);

  const got: number[] = [];
  for await (const chunk of stream.chunks) got.push(...chunk);
  assert.deepEqual(got, [10, 20, 30]);

  const done = await stream.completion;
  assert.equal(done.reason, 'finished');
  assert.equal(done.characters, 2);
  // usage 原样带出，不归一化——口径本来就不是 token。
  assert.deepEqual(done.usage, { characters: 2, total_tokens: 67 });
});

test('raw binary frames are accepted too', async () => {
  // 官方契约是 base64 走 JSON 帧，但实测报告里见过裸二进制帧。
  // 少认一种就是静默不出音，多认一种不会错。
  const { connect } = fakeRealtime((h) => {
    h.binary([4, 5]);
    h.json({ type: 'session.finished' });
  });
  const stream = await open(connect);
  const got: number[] = [];
  for await (const chunk of stream.chunks) got.push(...chunk);
  assert.deepEqual(got, [4, 5]);
});

test('response.audio.done does not end the session — only session.finished does', async () => {
  const { connect } = fakeRealtime((h) => {
    h.audio([1]);
    // 第一轮结束。把它当终点就会在第一个句子边界处截断。
    h.json({ type: 'response.audio.done' });
    h.json({ type: 'response.output_item.done' });
    h.json({ type: 'response.done', response: {} });
    // 第二轮
    h.json({ type: 'response.created' });
    h.audio([2]);
    h.json({ type: 'response.audio.done' });
    h.json({ type: 'session.finished' });
  });
  const stream = await open(connect);

  const got: number[] = [];
  for await (const chunk of stream.chunks) got.push(...chunk);
  assert.deepEqual(got, [1, 2], '两轮 response 的音频都要收齐');
});

test('an error event maps to a sensible HTTP status', async () => {
  assert.equal(realtimeErrorStatus('invalid_value'), 400);
  assert.equal(realtimeErrorStatus('model_not_found'), 400);
  assert.equal(realtimeErrorStatus('permission_denied'), 403);
  assert.equal(realtimeErrorStatus('rate_limit_exceeded'), 429);
  // 认不出来别吞成网关故障，也别谎称是客户端的错。
  assert.equal(realtimeErrorStatus('something_new'), 502);
  assert.equal(realtimeErrorStatus(undefined), 502);

  const { connect } = fakeRealtime((h) => {
    h.json({ type: 'error', error: { code: 'invalid_value', message: 'Session update error' } });
  });
  await assert.rejects(
    () => open(connect),
    (e: unknown) => isUpstreamError(e) && (e as any).status === 400 && /Session update error/.test((e as any).message),
  );
});

test('a silent close says the endpoint does not validate model names', async () => {
  // 实测：拿「不存在的模型xyz」去连，照样回 session.created，然后一声不响地关掉。
  // 这是这套协议最会骗人的地方，错误信息必须把它说出来。
  const { connect } = fakeRealtime((h) => h.closeSocket());
  await assert.rejects(
    () => openBailianRealtimeTtsStream(null, 'sk-test', { model: '不存在的模型xyz', text: '你好', connect }, 3_000),
    (e: unknown) => isUpstreamError(e) && /不校验模型名/.test((e as any).message),
  );
});

test('completion always settles, whatever the socket does', async () => {
  const endings: Array<[string, (h: Handle) => void]> = [
    ['finished', (h) => h.json({ type: 'session.finished' })],
    ['error', (h) => h.json({ type: 'error', error: { code: 'x', message: 'y' } })],
    ['close-early', (h) => h.closeSocket()],
  ];

  for (const [name, ending] of endings) {
    let h!: Handle;
    const { connect } = fakeRealtime((handle) => { h = handle; handle.audio([1]); });
    const stream = await open(connect);
    const iterator = stream.chunks[Symbol.asyncIterator]();
    await iterator.next();
    ending(h);
    try {
      for (;;) {
        const next = await iterator.next();
        if (next.done) break;
      }
    } catch { /* 允许抛 */ }

    const raced = await Promise.race([
      stream.completion.then(() => 'settled'),
      new Promise((r) => setTimeout(() => r('HUNG'), 80)),
    ]);
    assert.equal(raced, 'settled', `${name}: completion 悬挂会让日志的 after() 永久挂住`);
  }
});
