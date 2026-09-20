import { encodeSSE, generatorToStream } from '../protocols/sse.ts';

/**
 * 把音频分片流整形成 OpenAI `/v1/audio/speech` 的两种 `stream_format`。
 *
 *  - `audio`：原始字节直接分块下发，客户端拿到的就是一个普通的音频流；
 *  - `sse`：`speech.audio.delta` 事件携带 base64，末尾一条 `speech.audio.done`。
 *
 * 两者共用同一条分片流，成本几乎一样，所以都支持——`sse` 多出来的那点体积
 * 换到的是结构化的结束与错误事件，而 `audio` 一旦开始出字节就只能靠截断表达失败。
 */

export interface AudioStreamUsage {
  /** 上游报告的字符数。音频不按 token 计价，所以不往 token 字段里塞。 */
  characters?: number;
  requestId?: string;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.byteLength === 0) return b;
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

/** `stream_format: "audio"`——原样透传，不做任何改写。 */
export function audioChunksToRawStream(
  chunks: AsyncGenerator<Uint8Array, void, undefined>,
  onDone: (error?: unknown) => void,
): ReadableStream<Uint8Array> {
  return generatorToStream(chunks as AsyncGenerator<Uint8Array>, onDone);
}

/**
 * `stream_format: "sse"`。
 *
 * base64 按 3 字节对齐切：不足 3 字节的尾巴留到下一片。
 * 不对齐也能用——OpenAI SDK 逐条解码每个 delta——但**把所有 delta 的 base64
 * 字符串先拼起来再整体解码**的客户端会在内部 padding 处读出垃圾。带 ≤2 字节
 * 过桥不花什么代价，却让两种客户端写法都正确。
 */
export function audioChunksToSseStream(
  chunks: AsyncGenerator<Uint8Array, void, undefined>,
  completion: Promise<AudioStreamUsage>,
  onDone: (error?: unknown) => void,
): ReadableStream<Uint8Array> {
  async function* sse(): AsyncGenerator<Uint8Array> {
    let carry = new Uint8Array(0);
    try {
      for await (const chunk of chunks) {
        const merged = concat(carry, chunk);
        const keep = merged.byteLength % 3;
        const emit = merged.subarray(0, merged.byteLength - keep);
        carry = keep > 0 ? merged.slice(merged.byteLength - keep) : new Uint8Array(0);
        if (emit.byteLength > 0) {
          yield encodeSSE(null, { type: 'speech.audio.delta', audio: Buffer.from(emit).toString('base64') });
        }
      }
      if (carry.byteLength > 0) {
        yield encodeSSE(null, { type: 'speech.audio.delta', audio: Buffer.from(carry).toString('base64') });
      }

      const usage = await completion;
      yield encodeSSE(null, {
        type: 'speech.audio.done',
        // 阿里云按字符计价，不按 token。编一个 token 数出来就会在仪表盘上得到
        // 一个对不上账的数字；保留 OpenAI 的字段形状但填零，真实数字放在扩展字段里。
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        x_model_center: {
          input_characters: usage.characters ?? null,
          request_id: usage.requestId ?? null,
        },
      });
    } catch (e) {
      // SSE 比裸字节多一条命：错误能作为事件送达，不用让客户端从截断的 body 里猜。
      yield encodeSSE(null, {
        type: 'error',
        error: { message: (e instanceof Error ? e.message : String(e)).slice(0, 500), code: 'upstream_error' },
      });
    }
  }

  return generatorToStream(sse(), onDone);
}
