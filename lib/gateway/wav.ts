/**
 * WAV 头里的长度字段回填。
 *
 * 百炼的 WebSocket 合成是边合成边发的，所以它发出的 WAV 头把 RIFF 与 data 的
 * 长度都写成 `0x7FFFFFFF` 附近的占位值（≈2GB）——发第一个字节时它自己也不知道
 * 总共会有多长。
 *
 * **流式下这没办法**，但非流式是等整包合成完才返回的，长度完全知道。留着占位值，
 * 宽容的解析器（ffmpeg 之类）照常播，严格按头部长度读的解析器会认为文件被截断。
 *
 * 零 import：要能被 `npm run test:core` 的 strip-only 模式直接引用。
 */

const RIFF = 0x52494646; // "RIFF"
const WAVE = 0x57415645; // "WAVE"
const DATA = 0x64617461; // "data"

/** 头 12 字节是不是一个 RIFF/WAVE 容器。 */
export function isWav(buf: Uint8Array): boolean {
  if (buf.byteLength < 12) return false;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getUint32(0, false) === RIFF && view.getUint32(8, false) === WAVE;
}

/**
 * 按实际字节数改写 RIFF 与 data 两处长度。
 *
 * 就地改写传入的 buffer 并返回它——调用方手上那份本来就是刚从上游收齐的整包，
 * 再拷一份没有意义。不是 WAV、或者结构读不通，就原样返回，绝不猜。
 */
export function backfillWavSizes(buf: Uint8Array): Uint8Array {
  if (!isWav(buf)) return buf;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // RIFF 块长度 = 整个文件减去 "RIFF" 与长度字段本身这 8 字节。
  view.setUint32(4, buf.byteLength - 8, true);

  // 逐块走到 data。块头是 4 字节 id + 4 字节长度，奇数长度要补一个填充字节。
  let offset = 12;
  while (offset + 8 <= buf.byteLength) {
    const id = view.getUint32(offset, false);
    const declared = view.getUint32(offset + 4, true);
    if (id === DATA) {
      view.setUint32(offset + 4, buf.byteLength - (offset + 8), true);
      return buf;
    }
    // 非 data 块的长度是可信的（fmt 之类都是定长），但占位值会让我们走飞。
    if (declared > buf.byteLength) return buf;
    offset += 8 + declared + (declared % 2);
  }
  return buf;
}
