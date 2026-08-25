export class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly data?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Browser JSON request helper with consistent non-2xx error parsing. */
export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : typeof data === 'string' && data.trim()
        ? data
        : `请求失败（HTTP ${response.status}）`;
    throw new HttpError(message, response.status, data);
  }

  return data as T;
}
