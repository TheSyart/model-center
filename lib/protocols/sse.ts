/** SSE 解析/编码工具（§3.2 流式转换的基础件）。 */

export interface SSEEvent {
  /** event: 字段（OpenAI SSE 无此字段，为 null；Anthropic 有） */
  event: string | null;
  /** data: 字段（多行已拼接） */
  data: string;
}

const MAX_OBSERVED_EVENT_CHARS = 1024 * 1024;

/**
 * 在同一条客户端读取链路上观察 SSE 事件。
 *
 * 与 ReadableStream.tee() 不同，这个包装器只在下游 pull 时读取一个上游块，
 * 因而不会让日志解析分支提前抽干上游；仅保留尚未组成完整事件的一小段文本。
 * 观察回调的异常会被隔离，绝不影响客户端收到的原始字节。
 */
export function observeSSEStream(
  input: ReadableStream<Uint8Array>,
  onEvent: (event: SSEEvent) => void,
): { stream: ReadableStream<Uint8Array>; done: Promise<void> } {
  const reader = input.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let observing = true;
  let settled = false;
  let released = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const release = () => {
    if (released) return;
    released = true;
    try {
      reader.releaseLock();
    } catch {
      // reader 仍有未完成读取时由后续完成路径释放
      released = false;
    }
  };
  const settle = () => {
    if (settled) return;
    settled = true;
    resolveDone();
  };
  const emitAvailable = (text: string) => {
    if (!observing) return;
    const previousLength = buffer.length;
    buffer += text;
    // 非法上游若长期不发事件分隔符，只停用指标解析，原始字节仍继续透传。
    if (buffer.length > MAX_OBSERVED_EVENT_CHARS) {
      observing = false;
      buffer = '';
      return;
    }
    let searchFrom = Math.max(0, previousLength - 3);
    for (;;) {
      const lfIndex = buffer.indexOf('\n\n', searchFrom);
      const crlfIndex = buffer.indexOf('\r\n\r\n', searchFrom);
      const useCrlf = crlfIndex >= 0 && (lfIndex < 0 || crlfIndex <= lfIndex);
      const index = useCrlf ? crlfIndex : lfIndex;
      if (index < 0) break;
      const separatorLength = useCrlf ? 4 : 2;
      const rawEvent = buffer.slice(0, index);
      buffer = buffer.slice(index + separatorLength);
      searchFrom = 0;
      let event: string | null = null;
      const dataLines: string[] = [];
      for (const line of rawEvent.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      if (dataLines.length === 0) continue;
      try {
        onEvent({ event, data: dataLines.join('\n') });
      } catch {
        // 统计观察失败不能破坏模型流
      }
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          emitAvailable(decoder.decode());
          settle();
          release();
          controller.close();
          return;
        }
        emitAvailable(decoder.decode(result.value, { stream: true }));
        controller.enqueue(result.value);
      } catch (error) {
        settle();
        release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        settle();
        release();
      }
    },
  });

  return { stream, done };
}

/** 把字节流解析为 SSE 事件序列。流结束或出错时结束迭代。 */
export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event: string | null = null;
        const dataLines: string[] = [];
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
        }
        if (dataLines.length > 0) yield { event, data: dataLines.join('\n') };
      }
    }
  } finally {
    // 下游（客户端断连）取消时，向上游传播取消
    try {
      await reader.cancel();
    } catch {
      // 忽略
    }
    reader.releaseLock();
  }
}

const encoder = new TextEncoder();

/** 编码一条 SSE 事件。 */
export function encodeSSE(event: string | null, data: unknown): Uint8Array {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return encoder.encode((event ? `event: ${event}\n` : '') + `data: ${payload}\n\n`);
}

export function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * 把异步 Uint8Array 生成器包装成 ReadableStream。
 * 生成器正常结束/出错/被取消时回调 onDone（用于 resolve usage、释放资源）。
 */
export function generatorToStream(
  gen: AsyncGenerator<Uint8Array>,
  onDone: (error?: unknown) => void,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await gen.next();
        if (done) {
          controller.close();
          onDone();
        } else {
          controller.enqueue(value);
        }
      } catch (e) {
        controller.error(e);
        onDone(e);
      }
    },
    async cancel() {
      try {
        await gen.return(undefined);
      } catch {
        // 忽略
      }
      onDone();
    },
  });
}
