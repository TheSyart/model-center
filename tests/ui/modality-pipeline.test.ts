import { beforeAll, afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * after() 在测试里立即执行，这样日志断言不必等事件循环。
 * 流式分支的回调是 async 的，所以把它的 Promise 收集起来供 flushAfter() 等待。
 */
const afterCalls: Array<Promise<unknown>> = [];
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (fn: () => unknown) => {
      const result = fn();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        afterCalls.push(result as Promise<unknown>);
      }
    },
  };
});

async function flushAfter(): Promise<void> {
  while (afterCalls.length > 0) await afterCalls.shift();
}

let runModalityRequest: typeof import('../../lib/gateway/modality-pipeline').runModalityRequest;
let createToken: typeof import('../../lib/services/token').createToken;
let encrypt: typeof import('../../lib/crypto').encrypt;
let sqlite: typeof import('../../lib/db').sqlite;

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-modality-'));

/** api_key_enc 故意写成解不开的垃圾：只要走到 decrypt 就会抛 500，于是 400 本身就是"没解密"的证据。 */
const UNDECRYPTABLE = 'not-a-valid-ciphertext';

function seedProvider(slug: string, apiKeyEnc: string): string {
  const id = crypto.randomUUID();
  sqlite
    .prepare(
      `INSERT INTO providers(id, slug, name, protocol, base_url, preset_key, api_key_enc, enabled, priority, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,1,0,?,?)`,
    )
    .run(id, slug, slug, 'openai', 'https://example.invalid/v1', slug, apiKeyEnc, Date.now(), Date.now());
  return id;
}

function seedModel(providerId: string, modelId: string): void {
  sqlite
    .prepare('INSERT INTO models(id, provider_id, model_id, enabled, synced) VALUES(?,?,?,1,1)')
    .run(crypto.randomUUID(), providerId, modelId);
}

function lastLog() {
  return sqlite.prepare('SELECT * FROM request_logs ORDER BY rowid DESC LIMIT 1').get() as
    | Record<string, unknown>
    | undefined;
}

/** 只关心准入与记账，上游调用本身用一个不发网络请求的 execute 替身。 */
function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    entry: 'openai' as const,
    clientSignal: new AbortController().signal,
    accepts: (target: { provider: { slug: string }; modelId: string }) =>
      target.provider.slug === 'bailian' && target.modelId.includes('tts'),
    rejectMessage: () => '该模型不在允许的服务商目录内',
    errorResponse: (status: number, message: string, code: string | null) =>
      Response.json({ error: { message, code } }, { status }),
    execute: async () => ({ response: Response.json({ ok: true }) }),
    ...overrides,
  };
}

beforeAll(async () => {
  process.env.MASTER_KEY = 'test-modality-only';
  process.env.MODEL_CENTER_DB_DIR = directory;
  ({ runModalityRequest } = await import('../../lib/gateway/modality-pipeline'));
  ({ createToken } = await import('../../lib/services/token'));
  ({ encrypt } = await import('../../lib/crypto'));
  ({ sqlite } = await import('../../lib/db'));

  const bailian = seedProvider('bailian', encrypt('sk-real-bailian-key'));
  seedModel(bailian, 'cosyvoice-v3-tts');
  const other = seedProvider('some-reseller', UNDECRYPTABLE);
  seedModel(other, 'cheap-tts-clone');
});

beforeEach(() => {
  sqlite.prepare('DELETE FROM request_logs').run();
  afterCalls.length = 0;
});

afterAll(() => {
  sqlite?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('runModalityRequest', () => {
  test('rejects a provider outside the allow-list before decrypting its key', async () => {
    const execute = vi.fn(async () => ({ response: Response.json({ ok: true }) }));
    const res = await runModalityRequest(baseOptions({ requestedModel: 'cheap-tts-clone', execute }) as never);

    // 500 会意味着 decrypt 已经在那把垃圾密文上抛了 —— 也就是凭据已被取出。
    expect(res.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
    expect((await res.json()).error.code).toBe('model_not_supported');

    const log = lastLog();
    expect(log?.status).toBe(400);
    expect(log?.model_id).toBe('cheap-tts-clone');
  });

  test('returns 404 for an unknown model instead of collapsing it into a 500', async () => {
    const res = await runModalityRequest(baseOptions({ requestedModel: 'no-such-model' }) as never);
    expect(res.status).toBe(404);
    expect(lastLog()?.status).toBe(404);
  });

  test('enforces the token spend limit', async () => {
    const { row: token } = createToken({ name: '超限令牌', spend_limit: 1, spend_window: 'total' });
    sqlite
      .prepare('INSERT INTO request_logs(id, ts, status, cost, token_id) VALUES(?,?,?,?,?)')
      .run(crypto.randomUUID(), Date.now(), 200, 5, token.id);

    const execute = vi.fn(async () => ({ response: Response.json({ ok: true }) }));
    const res = await runModalityRequest(
      baseOptions({ requestedModel: 'cosyvoice-v3-tts', token, execute }) as never,
    );

    expect(res.status).toBe(429);
    expect(execute).not.toHaveBeenCalled();
    expect((await res.json()).error.code).toBe('spend_limit_exceeded');
  });

  test('logs a successful call with no usage, so no cost is invented', async () => {
    const res = await runModalityRequest(baseOptions({ requestedModel: 'cosyvoice-v3-tts' }) as never);
    expect(res.status).toBe(200);

    const log = lastLog()!;
    expect(log.status).toBe(200);
    expect(log.entry_protocol).toBe('openai');
    expect(log.model_id).toBe('cosyvoice-v3-tts');
    // 时长与字符数不是 token，不写进来，cost 也就不会被算出一个对不上账的数字。
    expect(log.prompt_tokens).toBeNull();
    expect(log.completion_tokens).toBeNull();
    expect(log.total_tokens).toBeNull();
    expect(log.cost).toBeNull();
  });

  test('stamps the log with the request start, not the moment the log is written', async () => {
    const before = Date.now();
    await runModalityRequest(
      baseOptions({
        requestedModel: 'cosyvoice-v3-tts',
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { response: Response.json({ ok: true }) };
        },
      }) as never,
    );
    const log = lastLog()!;
    // ts 必须落在请求开始的那一刻，否则 usage_daily 的跨日分桶会和主线链路不一致。
    expect(log.ts as number).toBeLessThan(before + 30);
    expect(log.latency_ms as number).toBeGreaterThanOrEqual(25);
  });

  test('writes a log when the upstream call throws', async () => {
    const res = await runModalityRequest(
      baseOptions({
        requestedModel: 'cosyvoice-v3-tts',
        execute: async () => {
          throw new Error('百炼 TTS 失败 (500): upstream exploded');
        },
      }) as never,
    );

    expect(res.status).toBe(500);
    const log = lastLog()!;
    expect(log.status).toBe(500);
    expect(log.error).toContain('upstream exploded');
    expect(log.provider_id).not.toBeNull();
  });

  test('reports an aborted client as 504 rather than a generic failure', async () => {
    const controller = new AbortController();
    const res = await runModalityRequest(
      baseOptions({
        requestedModel: 'cosyvoice-v3-tts',
        clientSignal: controller.signal,
        execute: async ({ signal }: { signal: AbortSignal }) => {
          controller.abort();
          const error = new Error('aborted');
          error.name = 'AbortError';
          expect(signal.aborted).toBe(true);
          throw error;
        },
      }) as never,
    );

    expect(res.status).toBe(504);
    expect(lastLog()?.error).toContain('客户端已断开');
  });

  test('propagates a non-2xx upstream status into the log', async () => {
    const res = await runModalityRequest(
      baseOptions({
        requestedModel: 'cosyvoice-v3-tts',
        execute: async () => ({
          response: Response.json({ code: 'InvalidParameter' }, { status: 400 }),
          status: 400,
          error: '{"code":"InvalidParameter"}',
        }),
      }) as never,
    );

    expect(res.status).toBe(400);
    const log = lastLog()!;
    expect(log.status).toBe(400);
    expect(log.error).toContain('InvalidParameter');
  });
});

describe('upstream status handling', () => {
  test('an upstream 4xx reaches the client as a 4xx, not a gateway 500', async () => {
    // 用真正会被抛出的类型，而不是等价的替身。
    const { UpstreamError } = await import('../../lib/upstream-error');
    const res = await runModalityRequest(
      baseOptions({
        requestedModel: 'cosyvoice-v3-tts',
        execute: async () => {
          // 上游嫌客户端参数不对：网关没坏，不该报 500。
          throw new UpstreamError(400, '百炼 TTS 失败 (400): InvalidParameter');
        },
      }) as never,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('upstream_error');
    expect(lastLog()?.status).toBe(400);
    expect(lastLog()?.error).toContain('InvalidParameter');
  });

  describe('streaming outcomes', () => {
    /** 一个手动控制结束时机的流式 outcome。 */
    function streamingOutcome() {
      let resolveDone!: (d: Record<string, unknown>) => void;
      const done = new Promise<Record<string, unknown>>((r) => { resolveDone = r; });
      return {
        done,
        finish: (d: Record<string, unknown>) => resolveDone(d),
        outcome: {
          response: new Response(new ReadableStream(), { status: 200 }),
          stream: { done },
        },
      };
    }

    test('the log waits for the stream to finish, and records stream: true', async () => {
      const s = streamingOutcome();
      const res = await runModalityRequest(
        baseOptions({ requestedModel: 'cosyvoice-v3-tts', execute: async () => s.outcome }) as never,
      );

      expect(res.status).toBe(200);
      // 响应头已经发出，但流还没走完——这时写日志会记下一个假的时长。
      expect(lastLog()).toBeUndefined();

      s.finish({ firstTokenMs: 380, durationMs: 4200 });
      await flushAfter();

      const log = lastLog();
      expect(log?.stream).toBe(1);
      expect(log?.first_token_ms).toBe(380);
      expect(log?.duration_ms).toBe(4200);
      // 音频按时长与字符数计价，不是 token——这一条不因流式而改变。
      expect(log?.usage_json ?? null).toBeNull();
    });

    test('the wall-clock timeout stops at the response headers, not mid-stream', async () => {
      const s = streamingOutcome();
      let signal!: AbortSignal;
      await runModalityRequest(
        baseOptions({
          requestedModel: 'cosyvoice-v3-tts',
          timeoutMs: 20,
          execute: async (attempt: { signal: AbortSignal }) => { signal = attempt.signal; return s.outcome; },
        }) as never,
      );

      // 超时只约束首包。留着墙钟，一段两分钟的长合成会在半路被掐断。
      await new Promise((r) => setTimeout(r, 60));
      expect(signal.aborted).toBe(false);

      s.finish({});
      await flushAfter();
    });

    test('a client hang-up after the headers still aborts the upstream', async () => {
      const s = streamingOutcome();
      const client = new AbortController();
      let signal!: AbortSignal;
      await runModalityRequest(
        baseOptions({
          requestedModel: 'cosyvoice-v3-tts',
          clientSignal: client.signal,
          execute: async (attempt: { signal: AbortSignal }) => { signal = attempt.signal; return s.outcome; },
        }) as never,
      );

      // 监听摘早了，客户端挂断之后上游还在合成、还在计费。
      client.abort();
      expect(signal.aborted).toBe(true);

      s.finish({});
      await flushAfter();
    });

    test('a note from the transport reaches the log even though the status is 200', async () => {
      const s = streamingOutcome();
      await runModalityRequest(
        baseOptions({ requestedModel: 'cosyvoice-v3-tts', execute: async () => s.outcome }) as never,
      );

      // 字节已经开始流，状态码定死 200——日志是唯一还能说出真相的地方。
      s.finish({ error: '上游流异常: truncated' });
      await flushAfter();

      expect(lastLog()?.status).toBe(200);
      expect(lastLog()?.error).toContain('truncated');
    });

    test('a rejecting done still writes a log', async () => {
      const res = await runModalityRequest(
        baseOptions({
          requestedModel: 'cosyvoice-v3-tts',
          execute: async () => ({
            response: new Response(new ReadableStream(), { status: 200 }),
            stream: { done: Promise.reject(new Error('读流时炸了')) },
          }),
        }) as never,
      );

      expect(res.status).toBe(200);
      await flushAfter();
      expect(lastLog()?.error).toContain('流中断');
    });
  });
});
