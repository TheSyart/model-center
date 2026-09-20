import type { NextRequest } from 'next/server';

import { getRawCaptureEnabled } from './config.ts';
import { observeResponseBody } from './response-observer.ts';
import { getDefaultRawCaptureRuntime } from './runtime.ts';
import type { RawCaptureStore } from './store.ts';
import type { RawCaptureEntry, RawCaptureSession } from './types.ts';

export type RawCaptureRouteHandler = (request: NextRequest) => Response | Promise<Response>;

export interface RawCaptureOptions {
  entry: RawCaptureEntry;
  path: string;
}

type RawCaptureStoreWriter = Pick<RawCaptureStore, 'beginRecord'>;

export interface RawCaptureDependencies {
  getEnabled(): boolean;
  createStore(): RawCaptureStoreWriter | Promise<RawCaptureStoreWriter>;
  triggerArchiveCheck(): void | Promise<void>;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return String(error);
}

export async function triggerArchiveCheck(): Promise<void> {
  const runtime = await getDefaultRawCaptureRuntime();
  await runtime.archive.archiveClosedDays();
}

export const defaultRawCaptureDependencies: RawCaptureDependencies = {
  getEnabled: getRawCaptureEnabled,
  async createStore() {
    return (await getDefaultRawCaptureRuntime()).store;
  },
  triggerArchiveCheck,
};

function fireArchiveCheck(dependencies: RawCaptureDependencies): void {
  void Promise.resolve()
    .then(() => dependencies.triggerArchiveCheck())
    .catch(() => {
      // Archive maintenance is intentionally detached from the model response.
    });
}

async function failSession(session: RawCaptureSession, error: unknown): Promise<void> {
  try {
    await session.fail(errorMessage(error));
  } catch {
    // Capture metadata failures must not replace a handler error or response.
  }
}

function isStreamingResponse(contentType: string | null, headers: Headers): boolean {
  const kind = contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (kind === 'text/event-stream') return true;
  // 分块下发的音频没有 Content-Length，缓冲路径一定写了——以此区分二者，
  // 否则抓包列表会把流式语音标成非流式。
  return kind.startsWith('audio/') && !headers.has('content-length');
}

async function captureEnabledRequest(
  request: NextRequest,
  options: RawCaptureOptions,
  handler: RawCaptureRouteHandler,
  dependencies: RawCaptureDependencies,
): Promise<Response> {
  fireArchiveCheck(dependencies);

  let session: RawCaptureSession;
  try {
    const requestBody = new Uint8Array(await request.clone().arrayBuffer());
    const store = await dependencies.createStore();
    session = await store.beginRecord({
      entryProtocol: options.entry,
      path: options.path,
      requestBody,
    });
  } catch {
    return handler(request);
  }

  let response: Response;
  try {
    response = await handler(request);
  } catch (error) {
    await failSession(session, error);
    throw error;
  }

  const contentType = response.headers.get('content-type');
  const stream = isStreamingResponse(contentType, response.headers);
  const completion = {
    status: response.status,
    stream,
    contentType,
  };

  if (response.body === null) {
    try {
      await session.finish({
        ...completion,
        complete: true,
        captureError: null,
      });
    } catch {
      // An empty response remains usable even when capture finalization fails.
    }
    return response;
  }

  const observed = observeResponseBody(response.body, {
    write: (chunk) => session.appendResponse(chunk),
    close: (result) => session.finish({
      ...completion,
      complete: result.complete,
      captureError: result.captureError,
    }).then(() => undefined),
    fail: (error) => session.finish({
      ...completion,
      complete: false,
      captureError: `响应采集失败: ${errorMessage(error)}`,
    }).then(() => undefined),
  });
  void observed.done.catch((error) => failSession(session, error));

  return new Response(observed.stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function withRawCapture(
  options: RawCaptureOptions,
  handler: RawCaptureRouteHandler,
  dependencies: RawCaptureDependencies = defaultRawCaptureDependencies,
): RawCaptureRouteHandler {
  return (request) => {
    let enabled = false;
    try {
      enabled = dependencies.getEnabled();
    } catch {
      return handler(request);
    }
    if (!enabled) return handler(request);
    return captureEnabledRequest(request, options, handler, dependencies);
  };
}
