export interface ResponseCaptureResult {
  complete: boolean;
  responseBytes: number;
  captureError: string | null;
}

export interface ResponseCaptureSink {
  write(chunk: Uint8Array): Promise<void>;
  close(result: ResponseCaptureResult): Promise<void>;
  fail(error: unknown): Promise<void>;
}

export interface ResponseObserverOptions {
  maxBufferedBytes?: number;
}

const DEFAULT_MAX_BUFFERED_BYTES = 1024 * 1024;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return String(error);
}

function bufferLimit(options: ResponseObserverOptions): number {
  const configured = options.maxBufferedBytes;
  if (configured === undefined || !Number.isFinite(configured)) return DEFAULT_MAX_BUFFERED_BYTES;
  return Math.max(0, Math.trunc(configured));
}

/**
 * Mirrors one response stream to the client while recording copied chunks through
 * a finite, ordered queue. Capture failures never reject or truncate the client stream.
 */
export function observeResponseBody(
  input: ReadableStream<Uint8Array>,
  sink: ResponseCaptureSink,
  options: ResponseObserverOptions = {},
): { stream: ReadableStream<Uint8Array>; done: Promise<ResponseCaptureResult> } {
  const reader = input.getReader();
  const maxBufferedBytes = bufferLimit(options);
  let queuedBytes = 0;
  let responseBytes = 0;
  let captureError: string | null = null;
  let acceptingWrites = true;
  let writeFailed = false;
  let sinkFailed = false;
  let cancellationRequested = false;
  let released = false;
  let finalization: Promise<ResponseCaptureResult> | null = null;
  let writeQueue = Promise.resolve();
  let resolveDone!: (result: ResponseCaptureResult) => void;
  const done = new Promise<ResponseCaptureResult>((resolve) => {
    resolveDone = resolve;
  });

  const setCaptureError = (message: string): void => {
    if (captureError === null) captureError = message;
  };

  const release = (): void => {
    if (released) return;
    try {
      reader.releaseLock();
      released = true;
    } catch {
      // A pending read is released by its completion or cancellation path.
    }
  };

  const failSink = async (error: unknown): Promise<void> => {
    if (sinkFailed) return;
    sinkFailed = true;
    try {
      await sink.fail(error);
    } catch {
      // Capture metadata failures cannot affect the client or reject done.
    }
  };

  const scheduleWrite = (chunk: Uint8Array): void => {
    if (!acceptingWrites) return;
    if (chunk.byteLength === 0) return;
    if (queuedBytes + chunk.byteLength > maxBufferedBytes) {
      acceptingWrites = false;
      setCaptureError(`响应采集缓冲上限 ${maxBufferedBytes} 字节已超出`);
      return;
    }

    const capturedChunk = chunk.slice();
    queuedBytes += capturedChunk.byteLength;
    writeQueue = writeQueue.then(async () => {
      if (writeFailed) return;
      try {
        await sink.write(capturedChunk);
        responseBytes += capturedChunk.byteLength;
      } catch (error) {
        writeFailed = true;
        acceptingWrites = false;
        setCaptureError(`响应采集写入失败: ${errorMessage(error)}`);
        await failSink(error);
      }
    }).finally(() => {
      queuedBytes -= capturedChunk.byteLength;
    });
  };

  const settle = (requestedComplete: boolean): Promise<ResponseCaptureResult> => {
    if (finalization) return finalization;
    finalization = (async () => {
      await writeQueue;
      let result: ResponseCaptureResult = {
        complete: requestedComplete && captureError === null,
        responseBytes,
        captureError,
      };

      if (!sinkFailed) {
        try {
          await sink.close(result);
        } catch (error) {
          acceptingWrites = false;
          setCaptureError(`响应采集结束失败: ${errorMessage(error)}`);
          result = { complete: false, responseBytes, captureError };
          await failSink(error);
        }
      }

      resolveDone(result);
      return result;
    })();
    return finalization;
  };

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          release();
          controller.close();
          if (!cancellationRequested) void settle(true);
          return;
        }

        scheduleWrite(result.value);
        controller.enqueue(result.value.slice());
      } catch (error) {
        release();
        if (cancellationRequested) return;
        acceptingWrites = false;
        setCaptureError(`响应流读取失败: ${errorMessage(error)}`);
        controller.error(error);
        void settle(false);
      }
    },
    async cancel(reason) {
      cancellationRequested = true;
      let cancellationError: unknown;
      try {
        await reader.cancel(reason);
      } catch (error) {
        cancellationError = error;
        setCaptureError(`响应流取消失败: ${errorMessage(error)}`);
      } finally {
        release();
        await settle(false);
      }
      if (cancellationError !== undefined) throw cancellationError;
    },
  });

  return { stream, done };
}
