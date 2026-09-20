import assert from 'node:assert/strict';
import test from 'node:test';
import { audioChunksToRawStream, audioChunksToSseStream } from '../lib/gateway/audio-stream.ts';
import { SSE_HEADERS, audioStreamHeaders } from '../lib/gateway/stream-headers.ts';

async function* from(chunks: number[][]): AsyncGenerator<Uint8Array, void, undefined> {
  for (const c of chunks) yield Uint8Array.from(c);
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  return Buffer.concat(parts.map((p) => Buffer.from(p)));
}

function parseEvents(raw: Uint8Array): any[] {
  return Buffer.from(raw)
    .toString('utf8')
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map((block) => JSON.parse(block.replace(/^data: /, '')));
}

test('raw mode passes the bytes through untouched', async () => {
  let doneCalls = 0;
  const out = await readAll(audioChunksToRawStream(from([[1, 2], [3]]), () => { doneCalls += 1; }));
  assert.deepEqual([...out], [1, 2, 3]);
  assert.equal(doneCalls, 1);
});

test('sse mode emits delta events and a done event carrying the character count', async () => {
  const stream = audioChunksToSseStream(
    from([[1, 2, 3]]),
    Promise.resolve({ characters: 7, requestId: 'req-9' }),
    () => {},
  );
  const events = parseEvents(await readAll(stream));

  assert.equal(events[0].type, 'speech.audio.delta');
  assert.deepEqual([...Buffer.from(events[0].audio, 'base64')], [1, 2, 3]);

  const done = events[events.length - 1];
  assert.equal(done.type, 'speech.audio.done');
  assert.equal(done.x_model_center.input_characters, 7);
  assert.equal(done.x_model_center.request_id, 'req-9');
  // 阿里云按字符计价；编一个 token 数出来就对不上账。
  assert.deepEqual(done.usage, { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
});

test('concatenating every delta reproduces the audio across misaligned boundaries', async () => {
  // 分片长度 1/2/4/5 都不是 3 的倍数——不做对齐，拼接后整体解码就会读出垃圾。
  const source = [[1], [2, 3], [4, 5, 6, 7], [8, 9, 10, 11, 12]];
  const expected = source.flat();

  const stream = audioChunksToSseStream(from(source), Promise.resolve({}), () => {});
  const events = parseEvents(await readAll(stream));
  const deltas = events.filter((e) => e.type === 'speech.audio.delta');

  // 写法一：逐条解码再拼字节。
  const perChunk = Buffer.concat(deltas.map((e) => Buffer.from(e.audio, 'base64')));
  assert.deepEqual([...perChunk], expected);

  // 写法二：先拼 base64 字符串再整体解码。这条正是 3 字节对齐在保护的。
  const joined = Buffer.from(deltas.map((e) => e.audio).join(''), 'base64');
  assert.deepEqual([...joined], expected);
});

test('an upstream failure mid-stream becomes an error event, not a torn body', async () => {
  async function* failing(): AsyncGenerator<Uint8Array, void, undefined> {
    yield Uint8Array.from([1, 2, 3]);
    throw new Error('上游中途报错');
  }

  const events = parseEvents(await readAll(audioChunksToSseStream(failing(), Promise.resolve({}), () => {})));
  assert.equal(events[0].type, 'speech.audio.delta');
  // 裸字节流到这一步只能截断；SSE 还能说出原因。
  assert.equal(events[1].type, 'error');
  assert.match(events[1].error.message, /上游中途报错/);
});

test('streaming headers never claim a length and always defeat nginx buffering', () => {
  const audio = audioStreamHeaders('audio/mpeg');
  assert.equal(audio['Content-Type'], 'audio/mpeg');
  // 写死长度，客户端读满就不读了，音频从中间截断。
  assert.equal('Content-Length' in audio, false);
  // proxy_buffering on 会把整段攒完再发，首包延迟等于全程合成时间。
  assert.equal(audio['X-Accel-Buffering'], 'no');
  assert.equal(SSE_HEADERS['X-Accel-Buffering'], 'no');
  // hop-by-hop，HTTP/2 下非法。
  assert.equal('Connection' in audio, false);
  assert.equal('Transfer-Encoding' in audio, false);
});
