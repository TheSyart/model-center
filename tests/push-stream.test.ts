import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushStream } from '../lib/protocols/push-stream.ts';

const bytes = (...values: number[]) => Uint8Array.from(values);

test('delivers pushed chunks in order and ends on close', async () => {
  const s = createPushStream();
  s.push(bytes(1, 2));
  s.push(bytes(3));
  s.close();

  const got: number[] = [];
  for await (const chunk of s.chunks) got.push(...chunk);
  assert.deepEqual(got, [1, 2, 3]);
});

test('a chunk pushed while the consumer is parked is not lost', async () => {
  const s = createPushStream();
  const got: number[] = [];

  const consumer = (async () => {
    for await (const chunk of s.chunks) got.push(...chunk);
  })();

  // 消费者已经挂在等待里；这一推必须叫醒它。
  await new Promise((r) => setTimeout(r, 5));
  s.push(bytes(7));
  await new Promise((r) => setTimeout(r, 5));
  s.push(bytes(8));
  s.close();

  await consumer;
  assert.deepEqual(got, [7, 8]);
});

test('a chunk pushed while the consumer is suspended inside yield is picked up', async () => {
  const s = createPushStream();
  const got: number[] = [];

  const consumer = (async () => {
    for await (const chunk of s.chunks) {
      got.push(...chunk);
      // 消费者在处理第一片时，第二片到达——它排在队列里，下一轮 while 取走。
      if (got.length === 1) s.push(bytes(2));
      await new Promise((r) => setTimeout(r, 1));
      if (got.length === 2) s.close();
    }
  })();

  s.push(bytes(1));
  await consumer;
  assert.deepEqual(got, [1, 2]);
});

test('failing after some chunks still delivers them, then throws', async () => {
  const s = createPushStream();
  s.push(bytes(1));
  s.push(bytes(2));
  s.fail(new Error('上游中途报错'));

  const got: number[] = [];
  await assert.rejects(
    (async () => {
      for await (const chunk of s.chunks) got.push(...chunk);
    })(),
    /上游中途报错/,
  );
  // 先排空再抛：已经拿到的音频不能因为末尾报错就丢。
  assert.deepEqual(got, [1, 2]);
});

test('a consumer that walks away triggers onCancel exactly once', async () => {
  const s = createPushStream();
  let cancels = 0;
  s.onCancel(() => { cancels += 1; });
  s.push(bytes(1));
  s.push(bytes(2));

  for await (const chunk of s.chunks) {
    assert.deepEqual([...chunk], [1]);
    break;
  }
  await s.chunks.return(undefined);

  assert.equal(cancels, 1);
});

test('normal completion and failure are not cancels', async () => {
  const done = createPushStream();
  let doneCancels = 0;
  done.onCancel(() => { doneCancels += 1; });
  done.push(bytes(1));
  done.close();
  for await (const _ of done.chunks) { /* 读到底 */ }
  assert.equal(doneCancels, 0);

  const failed = createPushStream();
  let failedCancels = 0;
  failed.onCancel(() => { failedCancels += 1; });
  failed.fail(new Error('boom'));
  await assert.rejects(async () => { for await (const _ of failed.chunks) { /* 空 */ } });
  assert.equal(failedCancels, 0);
});

test('exceeding the buffer ceiling fails instead of growing without bound', async () => {
  const s = createPushStream({ maxBufferedBytes: 4 });
  s.push(bytes(1, 2, 3));
  assert.equal(s.bufferedBytes(), 3);
  s.push(bytes(4, 5, 6));

  const got: number[] = [];
  await assert.rejects(
    (async () => {
      for await (const chunk of s.chunks) got.push(...chunk);
    })(),
    /积压超过 4 字节上限/,
  );
  assert.deepEqual(got, [1, 2, 3], '上限之前收到的照样交付');
});

test('close and fail are idempotent and the first one wins', async () => {
  const s = createPushStream();
  s.push(bytes(9));
  s.close();
  s.fail(new Error('晚到的错误应被忽略'));
  s.close();

  const got: number[] = [];
  for await (const chunk of s.chunks) got.push(...chunk);
  assert.deepEqual(got, [9]);
});
