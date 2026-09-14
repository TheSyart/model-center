/** Subscription wire contracts: CLIProxyAPI 7fa443dc and Gemini CLI 9c1b0a61.
 * OAuth and API-key endpoints are different even when their payload protocol is the same. */
import type { Credential, SubscriptionVendor } from './types.ts';

type Json = Record<string, any>;
interface WireRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}
// Known capability flags from the pinned Claude executor. Unknown caller flags do not
// become arbitrary upstream headers. Adding a future capability requires review.
const claudeCapabilityBetas = new Set([
  'context-1m-2025-08-07',
  'interleaved-thinking-2025-05-14',
  'redact-thinking-2026-02-12',
  'thinking-token-count-2026-05-13',
  'context-management-2025-06-27',
  'prompt-caching-scope-2026-01-05',
  'mid-conversation-system-2026-04-07',
  'advisor-tool-2026-03-01',
  'advanced-tool-use-2025-11-20',
  'effort-2025-11-24',
  'structured-outputs-2025-12-15',
  'thinking-display-updates-2026-08-18',
  'fast-mode-2026-02-01',
  'afk-mode-2026-01-31',
  'extended-cache-ttl-2025-04-11',
  'cache-diagnosis-2026-04-07',
]);
function claudeBetas(body: Json, requested: string | null | undefined): string {
  const betas = new Set([
    'claude-code-20250219',
    'oauth-2025-04-20',
    'interleaved-thinking-2025-05-14',
  ]);
  if (requested && requested.length <= 4096)
    for (const value of requested.split(',')) {
      const beta = value.trim();
      if (claudeCapabilityBetas.has(beta)) betas.add(beta);
    }
  const tools = Array.isArray(body.tools) ? body.tools : [];
  if (
    tools.some(
      (t) =>
        t &&
        (String(t.type ?? '').startsWith('tool_search_tool_') ||
          t.defer_loading === true ||
          t.input_examples !== undefined ||
          t.allowed_callers !== undefined)
    )
  )
    betas.add('advanced-tool-use-2025-11-20');
  if (tools.some((t) => t && String(t.type ?? '').startsWith('advisor_')))
    betas.add('advisor-tool-2026-03-01');
  if (body.context_management) betas.add('context-management-2025-06-27');
  if (body.output_config?.format || body.output_format)
    betas.add('structured-outputs-2025-12-15');
  if (body.output_config?.effort && body.thinking?.type !== 'disabled')
    betas.add('effort-2025-11-24');
  if (body.speed === 'fast') betas.add('fast-mode-2026-02-01');
  if (body.thinking?.display) betas.delete('redact-thinking-2026-02-12');
  if (
    body.thinking?.display === 'updates' &&
    body.thinking?.type !== 'disabled'
  )
    betas.add('thinking-display-updates-2026-08-18');
  if (
    Array.isArray(body.messages) &&
    body.messages.some((m) => m?.role === 'system')
  )
    betas.add('mid-conversation-system-2026-04-07');
  if (body.diagnostics) betas.add('cache-diagnosis-2026-04-07');
  return [...betas].join(',');
}
export function subscriptionWireRequest(
  vendor: SubscriptionVendor,
  credential: Credential,
  request: WireRequest,
  model: string,
  stream: boolean,
  anthropicBeta?: string | null
): WireRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${credential.accessToken}`,
  };
  const body = { ...(request.body as Json) };
  if (vendor === 'claude') {
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-beta'] = claudeBetas(
      body,
      anthropicBeta ??
        Object.entries(request.headers).find(
          ([name]) => name.toLowerCase() === 'anthropic-beta'
        )?.[1]
    );
    headers['x-app'] = 'cli';
    headers['User-Agent'] = 'claude-cli/2.1.220 (external, cli)';
    const identity =
      "You are Claude Code, Anthropic's official CLI for Claude.";
    if (!JSON.stringify(body.system ?? '').includes(identity)) {
      const existing =
        typeof body.system === 'string'
          ? [{ type: 'text', text: body.system }]
          : Array.isArray(body.system)
            ? body.system
            : [];
      body.system = [{ type: 'text', text: identity }, ...existing];
    }
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers,
      body: { ...body, model, stream },
    };
  }
  if (vendor === 'codex') {
    headers['ChatGPT-Account-Id'] = credential.accountKey;
    headers['OpenAI-Beta'] = 'responses=experimental';
    headers.originator = 'codex_cli_rs';
    headers.Accept = 'text/event-stream';
    headers['User-Agent'] = 'codex_cli_rs/0.149.1';
    for (const key of [
      'max_output_tokens',
      'max_completion_tokens',
      'temperature',
      'top_p',
      'previous_response_id',
      'generate',
      'prompt_cache_retention',
      'safety_identifier',
      'stream_options',
    ])
      delete body[key];
    if (typeof body.input === 'string')
      body.input = [
        { role: 'user', content: [{ type: 'input_text', text: body.input }] },
      ];
    return {
      url: 'https://chatgpt.com/backend-api/codex/responses',
      headers,
      body: {
        ...body,
        model,
        stream: true,
        store: false,
        instructions: body.instructions ?? '',
      },
    };
  }
  if (!credential.projectId)
    throw new Error('Gemini 账号缺少项目 ID，请重新登录');
  return {
    url: `https://cloudcode-pa.googleapis.com/v1internal:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`,
    headers,
    body: { project: credential.projectId, model, request: body },
  };
}

const encoder = new TextEncoder();
function object(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
/** TransformStream propagates cancellation to the source even while a read is pending. */
function mapSSE(
  input: ReadableStream<Uint8Array>,
  map: (json: Json, event: string | null) => Json | null
) {
  const decoder = new TextDecoder();
  let buffer = '';
  function emit(raw: string, c: TransformStreamDefaultController<Uint8Array>) {
    const lines = raw.split(/\r?\n/);
    const data = lines
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data || data === '[DONE]') return;
    const name =
      lines
        .find((l) => l.startsWith('event:'))
        ?.slice(6)
        .trim() ?? null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new Error('订阅服务返回无效流事件');
    }
    if (!object(parsed)) throw new Error('订阅服务返回无效流事件');
    const mapped = map(parsed, name);
    if (mapped !== null)
      c.enqueue(
        encoder.encode(
          `${name ? `event: ${name}\n` : ''}data: ${JSON.stringify(mapped)}\n\n`
        )
      );
  }
  function drain(c: TransformStreamDefaultController<Uint8Array>) {
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      const raw = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      if (raw.length > 1048576) throw new Error('订阅流事件过大');
      emit(raw, c);
    }
    if (buffer.length > 1048576) throw new Error('订阅流事件过大');
  }
  const transformer = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, c) {
      buffer += decoder.decode(chunk, { stream: true });
      drain(c);
    },
    flush(c) {
      buffer += decoder.decode();
      drain(c);
      if (buffer.trim()) emit(buffer, c);
    },
  });
  const piping = input.pipeTo(transformer.writable);
  void piping.catch(() => {});
  const reader = transformer.readable.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(c) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          reader.releaseLock();
          c.close();
        } else c.enqueue(chunk.value);
      } catch (error) {
        c.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => {});
      await piping.catch(() => {});
      reader.releaseLock();
    },
  });
}

export async function normalizeSubscriptionResponse(
  vendor: SubscriptionVendor,
  response: Response,
  clientStream: boolean,
  signal?: AbortSignal
): Promise<Response> {
  if (
    !response.ok ||
    vendor === 'claude' ||
    (vendor === 'codex' && clientStream)
  )
    return response;
  if (!response.body) throw new Error('订阅响应缺少内容');
  if (vendor === 'gemini' && clientStream) {
    const stream = mapSSE(response.body, (json) => {
      if (!object(json.response)) throw new Error('Gemini 响应缺少内容');
      return json.response;
    });
    return new Response(stream, {
      status: response.status,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
  let terminal: Json | null = null;
  const items = new Map<number, Json>();
  const input =
    vendor === 'codex'
      ? mapSSE(response.body, (json) => {
          if (json.type === 'error' || json.type === 'response.failed')
            throw new Error('Codex 请求失败');
          if (
            json.type === 'response.output_item.done' &&
            object(json.item) &&
            Number.isInteger(json.output_index) &&
            json.output_index >= 0 &&
            json.output_index < 10000
          )
            items.set(json.output_index, json.item);
          if (
            (json.type === 'response.completed' ||
              json.type === 'response.incomplete') &&
            object(json.response)
          )
            terminal = json.response;
          return json;
        })
      : response.body;
  const reader = input.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  const deadline = AbortSignal.any([
    AbortSignal.timeout(120000),
    ...(signal ? [signal] : []),
  ]);
  deadline.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      if (deadline.aborted) throw new Error('订阅请求已取消或超时');
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 16 * 1024 * 1024) throw new Error('订阅响应过大');
      if (vendor === 'gemini') chunks.push(next.value);
      if (terminal) break;
    }
    if (deadline.aborted) throw new Error('订阅请求已取消或超时');
    if (vendor === 'codex') {
      if (!terminal) throw new Error('Codex 未返回完整响应');
      const output = terminal as Json;
      if (!Array.isArray(output.output) || output.output.length === 0)
        output.output = [...items]
          .sort((a, b) => a[0] - b[0])
          .map(([, item]) => item);
      return Response.json(output);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new Error('Gemini 响应格式无效');
    }
    if (!object(parsed) || !object(parsed.response))
      throw new Error('Gemini 响应缺少内容');
    return Response.json(parsed.response);
  } finally {
    deadline.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
