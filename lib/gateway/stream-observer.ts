export interface StreamTiming {
  firstTokenMs: number | null;
  durationMs: number;
  cancelled: boolean;
}

/**
 * 在客户端实际读取的字节流边界记录首个非空块与结束时间。
 * 每次 pull 只读取一个上游块，因此保留原流的背压和字节内容。
 */
export function observeReadableStream(
  input: ReadableStream<Uint8Array>,
  startedAt: number,
  now: () => number = Date.now,
): { stream: ReadableStream<Uint8Array>; timing: Promise<StreamTiming> } {
  const reader = input.getReader();
  let firstTokenMs: number | null = null;
  let settled = false;
  let resolveTiming!: (timing: StreamTiming) => void;
  const timing = new Promise<StreamTiming>((resolve) => {
    resolveTiming = resolve;
  });

  const finish = (cancelled: boolean) => {
    if (settled) return;
    settled = true;
    resolveTiming({ firstTokenMs, durationMs: Math.max(0, now() - startedAt), cancelled });
  };

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          finish(false);
          controller.close();
          reader.releaseLock();
          return;
        }
        if (firstTokenMs == null && result.value.byteLength > 0) {
          firstTokenMs = Math.max(0, now() - startedAt);
        }
        controller.enqueue(result.value);
      } catch (error) {
        finish(false);
        controller.error(error);
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        finish(true);
        reader.releaseLock();
      }
    },
  });

  return { stream, timing };
}
