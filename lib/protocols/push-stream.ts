/**
 * 推模式数据源 → 拉模式异步迭代器。
 *
 * WebSocket 是推的：帧什么时候来由上游决定，**没有反压**——不读它也照发。
 * HTTP 响应体是拉的。这个原语架在中间，把推来的分片排队，等消费者来取。
 *
 * 因为没有真正的反压，这里的「背压」只能是**内存上限**：排队超过上限就转成
 * 失败，而不是让队列无限涨。这比悄悄丢分片好——丢了会得到一段听不出问题的
 * 残缺音频，失败至少是可见的。
 *
 * 两条由测试钉住的性质：
 *  1. **不丢唤醒。** 消费者只在队列空时才挂起，push/fail/close 都会叫醒它；
 *     消费者悬在 yield 期间到达的分片，下一轮循环会被取走。
 *  2. **先排空再抛。** 上游在发了 40KB 音频之后才报错，这 40KB 照样交付，
 *     然后才抛。对已经拿到 HTTP 200 的调用方来说，静默截断比异常结束更糟。
 *
 * 零 import：`npm run test:core` 跑在 node 的 strip-only 模式下，
 * 这个文件要能被厂商层和网关层同时引用。
 */

const DEFAULT_MAX_BUFFERED_BYTES = 16 * 1024 * 1024;

export interface PushStream {
  /** 单消费者。上游的错误从这里抛出；消费者提前退出会触发 onCancel。 */
  chunks: AsyncGenerator<Uint8Array, void, undefined>;
  /** 推入一个分片。超过 maxBufferedBytes 会自动转为 fail()。 */
  push(chunk: Uint8Array): void;
  /** 队列排空后抛给消费者。重复调用忽略。 */
  fail(error: unknown): void;
  /** 队列排空后正常结束迭代。重复调用忽略。 */
  close(): void;
  /** 消费者 break / return / 被 cancel 时回调，用来关闭上游连接。只触发一次。 */
  onCancel(listener: () => void): void;
  bufferedBytes(): number;
}

export function createPushStream(options?: { maxBufferedBytes?: number }): PushStream {
  const maxBufferedBytes = options?.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;

  const queue: Uint8Array[] = [];
  let queuedBytes = 0;
  let waiter: (() => void) | null = null;
  let closed = false;
  let failure: { error: unknown } | null = null;
  let cancelListener: (() => void) | null = null;
  let cancelled = false;

  const wake = () => {
    const w = waiter;
    waiter = null;
    w?.();
  };

  const fail = (error: unknown) => {
    if (closed || failure) return;
    failure = { error };
    wake();
  };

  const push = (chunk: Uint8Array) => {
    if (closed || failure) return;
    if (queuedBytes + chunk.byteLength > maxBufferedBytes) {
      fail(new Error(`音频分片积压超过 ${maxBufferedBytes} 字节上限：下游没有在读`));
      return;
    }
    queue.push(chunk);
    queuedBytes += chunk.byteLength;
    wake();
  };

  const close = () => {
    if (closed || failure) return;
    closed = true;
    wake();
  };

  async function* drain(): AsyncGenerator<Uint8Array, void, undefined> {
    try {
      for (;;) {
        while (queue.length > 0) {
          const chunk = queue.shift()!;
          queuedBytes -= chunk.byteLength;
          // yield 期间到达的分片会留在 queue 里，由下一轮 while 取走。
          yield chunk;
        }
        // 先排空再抛：已经收到的音频不能因为末尾报错就丢掉。
        if (failure) throw failure.error;
        if (closed) return;
        await new Promise<void>((resolve) => {
          waiter = resolve;
        });
      }
    } finally {
      // 正常结束与出错都不算取消；只有消费者主动走开才是。
      if (!closed && !failure && !cancelled) {
        cancelled = true;
        cancelListener?.();
      }
    }
  }

  return {
    chunks: drain(),
    push,
    fail,
    close,
    onCancel(listener: () => void) {
      cancelListener = listener;
    },
    bufferedBytes: () => queuedBytes,
  };
}
