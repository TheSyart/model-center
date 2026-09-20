import assert from 'node:assert/strict';
import test from 'node:test';
import { backfillWavSizes, isWav } from '../lib/gateway/wav.ts';

/** 造一个 WAV：44 字节标准头 + pcm 数据，两处长度都写成上游那种占位值。 */
function placeholderWav(dataBytes: number): Uint8Array {
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(0x7fffffff, 4); // 上游边合成边发时写的占位值
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(24000, 24);
  buf.writeUInt32LE(48000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(0x7fffffdb, 40); // 同样是占位
  for (let i = 0; i < dataBytes; i++) buf[44 + i] = i % 256;
  return new Uint8Array(buf);
}

test('placeholder RIFF and data sizes are rewritten to the real byte counts', () => {
  const wav = placeholderWav(1000);
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  // 上游声称约 2GB，实际只有 1044 字节——严格按头部长度读的解析器会以为文件被截断。
  assert.equal(view.getUint32(4, true), 0x7fffffff);

  backfillWavSizes(wav);
  assert.equal(view.getUint32(4, true), 1044 - 8, 'RIFF 长度 = 整包 - 8');
  assert.equal(view.getUint32(40, true), 1000, 'data 长度 = 实际采样字节数');
  // 音频数据本身一个字节都不能动。
  assert.equal(wav[44], 0);
  assert.equal(wav[44 + 999], 999 % 256);
});

test('a non-WAV buffer is returned untouched', () => {
  const mp3 = Uint8Array.from([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const before = [...mp3];
  assert.equal(isWav(mp3), false);
  assert.deepEqual([...backfillWavSizes(mp3)], before);
  // 短到读不出容器头的也不能崩。
  assert.deepEqual([...backfillWavSizes(Uint8Array.from([0x52, 0x49]))], [0x52, 0x49]);
});

test('a chunk layout that does not parse is left alone rather than guessed at', () => {
  const wav = placeholderWav(100);
  // 把 fmt 块的长度写成一个超过整包的值：走下去就会飞，此时应原样返回。
  new DataView(wav.buffer, wav.byteOffset, wav.byteLength).setUint32(16, 0x0fffffff, true);
  backfillWavSizes(wav);
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  assert.equal(view.getUint32(4, true), 144 - 8, 'RIFF 长度仍然回填');
  assert.equal(view.getUint32(40, true), 0x7fffffdb, 'data 长度读不到就别碰');
});

test('an already-correct header survives a second pass unchanged', () => {
  const wav = placeholderWav(512);
  backfillWavSizes(wav);
  const first = [...wav];
  backfillWavSizes(wav);
  assert.deepEqual([...wav], first);
});
