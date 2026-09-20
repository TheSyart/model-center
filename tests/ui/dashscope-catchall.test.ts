import { beforeAll, afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

// after() 在测试里同步执行，这样日志断言不必等事件循环。
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (fn: () => unknown) => { void fn(); } };
});

type Handler = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => Promise<Response>;
let GET: Handler;
let POST: Handler;
let createToken: typeof import('../../lib/services/token').createToken;
let encrypt: typeof import('../../lib/crypto').encrypt;
let sqlite: typeof import('../../lib/db').sqlite;

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-dashscope-'));
let gatewayKey = '';
let providerId = '';

function seedProvider(slug: string, presetKey: string, apiKeyEnc: string, workspaceId: string | null): string {
  const id = crypto.randomUUID();
  sqlite
    .prepare(
      `INSERT INTO providers(id, slug, name, protocol, base_url, preset_key, api_key_enc, enabled, priority, workspace_id, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,1,0,?,?,?)`,
    )
    .run(id, slug, slug, 'openai', 'https://example.invalid/v1', presetKey, apiKeyEnc, workspaceId, Date.now(), Date.now());
  return id;
}

function lastLog() {
  return sqlite.prepare('SELECT * FROM request_logs ORDER BY rowid DESC LIMIT 1').get() as Record<string, unknown> | undefined;
}

/** 模拟一次调用：路径按 /api/v1/ 之后的段传给 catch-all，和 Next 的行为一致。 */
function call(handler: Handler, method: string, pathname: string, init: { headers?: Record<string, string>; body?: string; search?: string } = {}) {
  const segments = pathname.replace(/^\/api\/v1\//, '').split('/');
  const req = new NextRequest(`http://localhost${pathname}${init.search ?? ''}`, {
    method,
    headers: init.headers,
    body: init.body,
  });
  return handler(req, { params: Promise.resolve({ path: segments }) });
}

const withKey = (extra: Record<string, string> = {}) => ({ authorization: `Bearer ${gatewayKey}`, ...extra });

beforeAll(async () => {
  process.env.MASTER_KEY = 'test-dashscope-only';
  process.env.MODEL_CENTER_DB_DIR = directory;
  ({ GET, POST } = await import('../../app/api/v1/[...path]/route'));
  ({ createToken } = await import('../../lib/services/token'));
  ({ encrypt } = await import('../../lib/crypto'));
  ({ sqlite } = await import('../../lib/db'));

  providerId = seedProvider('bailian', 'bailian', encrypt('sk-bailian-real'), 'llm-test-ws');
  gatewayKey = createToken({ name: '透传测试' }).plaintext;
});

beforeEach(() => {
  sqlite.prepare('DELETE FROM request_logs').run();
  vi.restoreAllMocks();
});

afterAll(() => {
  sqlite?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('DashScope passthrough catch-all', () => {
  test('refuses without a gateway key, and never touches upstream', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await call(POST, 'POST', '/api/v1/services/audio/tts/customization', { body: '{}' });
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    // DashScope 的错误信封，不是 OpenAI 的 { error: {...} }。
    expect(await res.json()).toMatchObject({ code: 'invalid_api_key' });
  });

  test('refuses paths outside the whitelist with 404, wrong methods with 405', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const off = await call(POST, 'POST', '/api/v1/services/aigc/text-generation/generation', { headers: withKey(), body: '{}' });
    expect(off.status).toBe(404);
    const wrongMethod = await call(GET, 'GET', '/api/v1/services/audio/tts/customization', { headers: withKey() });
    expect(wrongMethod.status).toBe(405);
    // 不是开放代理：白名单外一个字节都不转。
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('forwards with the Bailian key, injects the workspace, and passes the DashScope switches', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      seen = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ output: { voice_id: 'v1' }, request_id: 'r1' }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-request-id': 'r1' },
      });
    });

    const res = await call(POST, 'POST', '/api/v1/services/audio/tts/customization', {
      headers: withKey({
        'content-type': 'application/json',
        // 客户端想指定到别的业务空间——一律剥掉换成网关的。
        'x-dashscope-workspace': 'attacker',
        'x-dashscope-ossresourceresolve': 'enable',
        cookie: 'a=b',
      }),
      body: JSON.stringify({ model: 'voice-enrollment', input: { action: 'create_voice', url: 'oss://x' } }),
    });

    expect(res.status).toBe(200);
    expect(seen!.url).toBe('https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization');
    const headers = seen!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-bailian-real');
    expect(headers['x-dashscope-workspace']).toBe('llm-test-ws');
    expect(headers['x-dashscope-ossresourceresolve']).toBe('enable');
    expect('cookie' in headers).toBe(false);
    // 请求体一个字节不改：model 不被改写。
    expect(JSON.parse(new TextDecoder().decode(seen!.init.body as Uint8Array)).model).toBe('voice-enrollment');
    // 响应原样回去，X-Request-Id 带回来便于对着百炼工单排查。
    expect(await res.json()).toEqual({ output: { voice_id: 'v1' }, request_id: 'r1' });
    expect(res.headers.get('x-request-id')).toBe('r1');

    const log = lastLog();
    expect(log?.entry_protocol).toBe('dashscope');
    expect(log?.provider_id).toBe(providerId);
    expect(log?.model_id).toBe('voice-enrollment');
    expect(log?.status).toBe(200);
    expect(log?.stream).toBe(0);
  });

  test('GET with a query string keeps the query and sends no body', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      seen = { url: String(url), init: init ?? {} };
      return Response.json({ data: { policy: 'p', upload_host: 'h' } });
    });
    const res = await call(GET, 'GET', '/api/v1/uploads', {
      headers: withKey(),
      search: '?action=getPolicy&model=qwen-audio-3.0-tts-flash',
    });
    expect(res.status).toBe(200);
    expect(seen!.url).toBe('https://dashscope.aliyuncs.com/api/v1/uploads?action=getPolicy&model=qwen-audio-3.0-tts-flash');
    expect(seen!.init.method).toBe('GET');
    expect(seen!.init.body ?? null).toBeNull();
    // 没有请求体就没有 model 可记，别编一个。
    expect(lastLog()?.model_id).toBeNull();
  });

  test('streams SSE through unchanged and tells nginx not to buffer', async () => {
    const encoder = new TextEncoder();
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode('data: {"output":{"text":"你"}}\n\n'));
        c.enqueue(encoder.encode('data: {"output":{"text":"你好"}}\n\n'));
        c.close();
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(upstreamBody, { status: 200, headers: { 'content-type': 'text/event-stream', 'content-length': '999' } }),
    );

    const res = await call(POST, 'POST', '/api/v1/services/aigc/multimodal-generation/generation', {
      headers: withKey({ 'content-type': 'application/json', 'x-dashscope-sse': 'enable' }),
      body: JSON.stringify({ model: 'qwen-audio-3.0-asr-flash', input: {} }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    // 上游的长度不再可信（fetch 已解码），写死会让客户端读满就停。
    expect(res.headers.get('content-length')).toBeNull();
    expect(await res.text()).toBe('data: {"output":{"text":"你"}}\n\ndata: {"output":{"text":"你好"}}\n\n');
    expect(lastLog()?.stream).toBe(1);
    expect(lastLog()?.model_id).toBe('qwen-audio-3.0-asr-flash');
  });

  test('an upstream 4xx is returned as-is and its body lands in the log', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'InvalidParameter', message: 'preview_text should not be shorter than 15 characters' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const res = await call(POST, 'POST', '/api/v1/services/audio/tts/customization', {
      headers: withKey({ 'content-type': 'application/json' }),
      body: JSON.stringify({ model: 'voice-enrollment' }),
    });
    // 原样：调用方要的正是百炼的原始错误，网关不翻译。
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'InvalidParameter' });
    expect(lastLog()?.status).toBe(400);
    expect(String(lastLog()?.error)).toContain('preview_text');
  });

  test('a 3xx from upstream is handed back, not followed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'https://oss.example/audio.mp3' } }),
    );
    const res = await call(GET, 'GET', '/api/v1/tasks/task-1', { headers: withKey() });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://oss.example/audio.mp3');
  });

  test('a token over its spend limit is refused before any upstream call', async () => {
    const { row, plaintext } = createToken({ name: '超限', spend_limit: 1, spend_window: 'total' });
    sqlite.prepare('INSERT INTO request_logs(id, ts, status, cost, token_id) VALUES(?,?,?,?,?)').run(crypto.randomUUID(), Date.now(), 200, 5, row.id);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await call(GET, 'GET', '/api/v1/tasks/x', { headers: { authorization: `Bearer ${plaintext}` } });
    expect(res.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
