export interface StreamSetupTracker {
  stream(stream: ReadableStream<Uint8Array>): void;
  usage(promise: Promise<unknown>): void;
}

export async function cancelStreamBestEffort(
  stream: ReadableStream<Uint8Array> | null | undefined,
  reason: unknown,
): Promise<void> {
  if (!stream) return;
  try {
    await stream.cancel(reason);
  } catch {
    // The stream can already be locked by an adapter. Cancellation remains best-effort.
  }
}

/** Cleanup is deferred on success and guaranteed on setup failure. */
export async function runStreamSetupSafely<T>(
  upstreamBody: ReadableStream<Uint8Array>,
  cleanup: () => void,
  setup: (tracker: StreamSetupTracker) => T | Promise<T>,
): Promise<T> {
  let streamToCancel = upstreamBody;
  const usage = { promise: null as Promise<unknown> | null };
  const tracker: StreamSetupTracker = {
    stream(stream) { streamToCancel = stream; },
    usage(promise) { usage.promise = promise; },
  };
  try {
    return await setup(tracker);
  } catch (error) {
    if (usage.promise) void usage.promise.catch(() => undefined);
    await cancelStreamBestEffort(streamToCancel, error);
    cleanup();
    throw error;
  }
}
