import { beforeAll, afterAll, afterEach, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SubscriptionVendor } from '../../lib/subscriptions/types';
vi.mock('next/server', () => ({ after: () => {} }));
let pipeline: typeof import('../../lib/gateway/pipeline').runGatewayPipeline;
let store: typeof import('../../lib/subscriptions/runtime').subscriptionStore;
let sqlite: typeof import('../../lib/db').sqlite;
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'mc-subscription-pipeline-')
);
beforeAll(async () => {
  process.env.MASTER_KEY = 'test-pipeline-only';
  process.env.MODEL_CENTER_DB_DIR = directory;
  ({ runGatewayPipeline: pipeline } = await import(
    '../../lib/gateway/pipeline'
  ));
  ({ subscriptionStore: store } = await import(
    '../../lib/subscriptions/runtime'
  ));
  ({ sqlite } = await import('../../lib/db'));
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => {
  sqlite?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
for (const vendor of ['claude', 'codex', 'gemini', 'antigravity', 'copilot'] as SubscriptionVendor[])
  for (const stream of [false, true])
    test(`${vendor} OAuth traverses actual router and protocol conversion (${stream ? 'SSE' : 'JSON'})`, async () => {
      const a = store.saveAccount(vendor, {
        accessToken: 'test-oauth',
        refreshToken: 'test-refresh',
        accountKey: `${vendor}-${stream}`,
        email: null,
        expiresAt: Date.now() + 3600000,
        projectId: ['gemini', 'antigravity'].includes(vendor) ? 'test-project' : null,
      });
      const linked = store.connectGateway(a.id, ['test-model']);
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit) => {
          expect(new Headers(init.headers).get('authorization')).toBe(
            'Bearer test-oauth'
          );
          const request = JSON.parse(String(init.body));
          if (vendor === 'codex') {
            expect(url).toBe('https://chatgpt.com/backend-api/codex/responses');
            expect(request.store).toBe(false);
            const events = [
              { type: 'response.created', response: { id: 'r1' } },
              {
                type: 'response.output_item.added',
                output_index: 0,
                item: {
                  type: 'message',
                  id: 'm1',
                  role: 'assistant',
                  content: [],
                },
              },
              {
                type: 'response.output_text.delta',
                item_id: 'm1',
                output_index: 0,
                content_index: 0,
                delta: 'hello',
              },
              {
                type: 'response.completed',
                response: {
                  id: 'r1',
                  status: 'completed',
                  output: [
                    {
                      type: 'message',
                      role: 'assistant',
                      content: [{ type: 'output_text', text: 'hello' }],
                    },
                  ],
                  usage: { input_tokens: 4, output_tokens: 2 },
                },
              },
            ];
            return new Response(
              events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
              { headers: { 'Content-Type': 'text/event-stream' } }
            );
          }
          if (vendor === 'gemini' || vendor === 'antigravity') {
            if (vendor === 'antigravity') {
              expect(url).toBe(`https://daily-cloudcode-pa.googleapis.com/v1internal:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`);
              expect(request.userAgent).toBe('antigravity');
              expect(request.requestType).toBe('agent');
              expect(request.request.sessionId).toMatch(/^-\d+$/);
            }
            expect(request.project).toBe('test-project');
            expect(request.request.contents).toBeDefined();
            const body = {
              response: {
                candidates: [
                  {
                    content: { role: 'model', parts: [{ text: 'hello' }] },
                    finishReason: 'STOP',
                  },
                ],
                usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 },
              },
            };
            return stream
              ? new Response(`data: ${JSON.stringify(body)}\n\n`)
              : Response.json(body);
          }
          if (vendor === 'copilot') {
            expect(url).toBe('https://api.githubcopilot.com/chat/completions');
            expect(new Headers(init.headers).get('copilot-integration-id')).toBe('vscode-chat');
            const chunk = {
              id: 'c1',
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: 'hello' } }],
            };
            return stream
              ? new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
                  headers: { 'Content-Type': 'text/event-stream' },
                })
              : Response.json({
                  id: 'c1',
                  object: 'chat.completion',
                  choices: [
                    { index: 0, message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' },
                  ],
                  usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
                });
          }
          expect(url).toBe('https://api.anthropic.com/v1/messages');
          expect(new Headers(init.headers).has('x-api-key')).toBe(false);
          const body = {
            id: 'msg',
            type: 'message',
            role: 'assistant',
            model: 'test-model',
            content: [{ type: 'text', text: 'hello' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 4, output_tokens: 2 },
          };
          return stream
            ? new Response(
                `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { ...body, content: [] } })}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n`
              )
            : Response.json(body);
        })
      );
      const response = await pipeline({
        entry: 'openai',
        rawBody: { messages: [{ role: 'user', content: 'hello' }] },
        ir: { messages: [{ role: 'user', content: 'hello' }] },
        requestedModel: `${linked.providerSlug}/test-model`,
        stream,
        includeUsage: true,
        clientSignal: new AbortController().signal,
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('hello');
      expect(text).not.toContain('test-oauth');
      if (stream) expect(text).toContain('[DONE]');
      else expect(JSON.parse(text).choices[0].message.content).toBe('hello');
    });
test('401 rotates credential once, retries and discards upstream error bodies', async () => {
  const a = store.saveAccount('claude', {
    accessToken: 'old-token',
    refreshToken: 'test-refresh',
    accountKey: 'retry-account',
    email: null,
    expiresAt: Date.now() + 3600000,
  });
  const linked = store.connectGateway(a.id, ['retry-model']);
  let attempts = 0;
  let cancelled = false;
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (url === 'https://platform.claude.com/v1/oauth/token')
      return Response.json({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
    attempts++;
    if (attempts === 1)
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('private-error'));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { status: 401 }
      );
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer new-token'
    );
    return Response.json({
      id: 'msg',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'retry worked' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 2 },
    });
  });
  vi.stubGlobal('fetch', fetcher);
  const response = await pipeline({
    entry: 'openai',
    rawBody: { messages: [{ role: 'user', content: 'hi' }] },
    ir: { messages: [{ role: 'user', content: 'hi' }] },
    requestedModel: `${linked.providerSlug}/retry-model`,
    stream: false,
    includeUsage: false,
    clientSignal: new AbortController().signal,
  });
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('retry worked');
  expect(attempts).toBe(2);
  expect(cancelled).toBe(true);
  expect(store.getCredential(a.id).refreshToken).toBe('new-refresh');
});
test('subscription management route binds OAuth session to browser and rejects cross-origin mutations', async () => {
  const route = await import(
    '../../app/api/admin/subscriptions/[[...path]]/route'
  );
  const call = (
    path: string[],
    body: unknown,
    origin = 'http://localhost:3000',
    cookie?: string
  ) =>
    route.POST(
      new Request(
        `http://localhost:3000/api/admin/subscriptions/${path.join('/')}`,
        {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: JSON.stringify(body),
        }
      ),
      { params: Promise.resolve({ path }) }
    );
  expect(
    (await call(['oauth'], { vendor: 'codex' }, 'https://evil.example')).status
  ).toBe(403);
  expect((await call(['oauth'], { vendor: 'gemini' })).status).toBe(410);
  const start = await call(['oauth'], { vendor: 'codex' });
  expect(start.status).toBe(201);
  expect(start.headers.get('cache-control')).toContain('no-store');
  expect(start.headers.get('set-cookie')).toContain('HttpOnly');
  const body = await start.json();
  expect(JSON.stringify(body)).not.toMatch(/verifier|refreshToken|accessToken/);
  const cookie = start.headers.get('set-cookie')!.split(';')[0];
  expect(
    (
      await call(
        ['oauth', 'complete'],
        { sessionId: body.session.id, input: 'bad' },
        'http://localhost:3000',
        'mc_subscription_owner=' + 'b'.repeat(64)
      )
    ).status
  ).toBe(409);
  const cancelled = await route.DELETE(
    new Request(
      `http://localhost:3000/api/admin/subscriptions/oauth/${body.session.id}`,
      {
        method: 'DELETE',
        headers: { Origin: 'http://localhost:3000', Cookie: cookie },
      }
    ),
    { params: Promise.resolve({ path: ['oauth', body.session.id] }) }
  );
  expect(cancelled.status).toBe(200);
  expect(
    (
      await call(
        ['oauth', 'complete'],
        { sessionId: body.session.id, input: 'bad' },
        'http://localhost:3000',
        cookie
      )
    ).status
  ).toBe(409);
});
test('subscription usage retains token counts but never creates an API cost', async () => {
  const a = store.saveAccount('codex', {
    accessToken: 'cost-token',
    refreshToken: 'refresh',
    accountKey: 'cost-account',
    email: null,
    expiresAt: Date.now() + 3600000,
  });
  const linked = store.connectGateway(a.id, ['cost-model']);
  sqlite
    .prepare(
      'UPDATE models SET input_price=100,output_price=200 WHERE provider_id=?'
    )
    .run(linked.providerId);
  const { writeRequestLog } = await import('../../lib/gateway/logger');
  writeRequestLog({
    ts: Date.now(),
    providerId: linked.providerId,
    modelId: 'cost-model',
    alias: null,
    entryProtocol: 'openai',
    status: 200,
    latencyMs: 1,
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    error: null,
    stream: false,
  });
  const row = sqlite
    .prepare('SELECT cost,prompt_tokens FROM request_logs WHERE provider_id=?')
    .get(linked.providerId) as { cost: number | null; prompt_tokens: number };
  expect(row.cost).toBeNull();
  expect(row.prompt_tokens).toBe(100);
});
test('429 quota rejection fails over to the next explicitly configured account', async () => {
  const link = (key: string) =>
    store.connectGateway(
      store.saveAccount('claude', {
        accessToken: key,
        refreshToken: 'refresh',
        accountKey: key,
        email: null,
        expiresAt: Date.now() + 3600000,
      }).id,
      ['failover-model']
    );
  const first = link('exhausted-account'),
    second = link('available-account');
  sqlite
    .prepare(
      'INSERT INTO route_aliases(id,alias,targets,enabled) VALUES(?,?,?,1)'
    )
    .run(
      'fallback-id',
      'subscription-fallback',
      JSON.stringify([
        { provider_id: first.providerId, model_id: 'failover-model' },
        { provider_id: second.providerId, model_id: 'failover-model' },
      ])
    );
  const seen: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const auth = new Headers(init.headers).get('authorization')!;
      seen.push(auth);
      return auth === 'Bearer exhausted-account'
        ? Response.json({ error: 'limit reached' }, { status: 429 })
        : Response.json({
            id: 'msg',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'backup account' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 1, output_tokens: 2 },
          });
    })
  );
  const response = await pipeline({
    entry: 'openai',
    rawBody: { messages: [{ role: 'user', content: 'hi' }] },
    ir: { messages: [{ role: 'user', content: 'hi' }] },
    requestedModel: 'subscription-fallback',
    stream: false,
    includeUsage: false,
    clientSignal: new AbortController().signal,
  });
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('backup account');
  expect(seen).toEqual([
    'Bearer exhausted-account',
    'Bearer available-account',
  ]);
});
test('native Anthropic capability beta reaches the subscription upstream through actual pipeline', async () => {
  const a = store.saveAccount('claude', {
    accessToken: 'beta-token',
    refreshToken: 'refresh',
    accountKey: 'beta-account',
    email: null,
    expiresAt: Date.now() + 3600000,
  });
  const linked = store.connectGateway(a.id, ['beta-model']);
  const tools = [{ type: 'tool_search_tool_regex_20251119', name: 'search' }];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const betas = new Headers(init.headers).get('anthropic-beta')!.split(',');
      expect(betas).toContain('context-1m-2025-08-07');
      expect(betas).toContain('advanced-tool-use-2025-11-20');
      expect(betas).toContain('oauth-2025-04-20');
      expect(JSON.parse(String(init.body)).tools).toEqual(tools);
      return Response.json({
        id: 'beta-msg',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    })
  );
  const raw = {
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 32,
    tools,
  };
  const response = await pipeline({
    entry: 'anthropic',
    rawBody: raw,
    ir: { messages: [] },
    requestedModel: `${linked.providerSlug}/beta-model`,
    stream: false,
    includeUsage: true,
    anthropicBeta: 'context-1m-2025-08-07',
    clientSignal: new AbortController().signal,
  });
  expect(response.status).toBe(200);
  expect((await response.json()).content[0].text).toBe('ok');
});
test('explicit public HTTPS origin permits proxy login and sets Secure owner cookie', async () => {
  const previous = process.env.MODEL_CENTER_PUBLIC_ORIGIN;
  try {
    process.env.MODEL_CENTER_PUBLIC_ORIGIN = 'https://models.example.com';
    const route = await import(
      '../../app/api/admin/subscriptions/[[...path]]/route'
    );
    const request = (origin: string) =>
      new Request('http://localhost:3000/api/admin/subscriptions/oauth', {
        method: 'POST',
        headers: {
          Host: 'models.example.com',
          Origin: origin,
          'Content-Type': 'application/json',
          'X-Forwarded-Proto': 'http',
        },
        body: JSON.stringify({ vendor: 'codex' }),
      });
    const response = await route.POST(request('https://models.example.com'), {
      params: Promise.resolve({ path: ['oauth'] }),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toContain('; Secure');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(
      (
        await route.POST(request('https://evil.example'), {
          params: Promise.resolve({ path: ['oauth'] }),
        })
      ).status
    ).toBe(403);
  } finally {
    if (previous === undefined) delete process.env.MODEL_CENTER_PUBLIC_ORIGIN;
    else process.env.MODEL_CENTER_PUBLIC_ORIGIN = previous;
  }
});
test('native Responses observer records Codex data-only terminal usage', async () => {
  const { observeResponsesUsageFromSSE } = await import(
    '../../lib/protocols/responses'
  );
  const bytes =
    'data: {"type":"response.completed","response":{"usage":{"input_tokens":7,"output_tokens":3,"total_tokens":10}}}\n\n';
  const observed = observeResponsesUsageFromSSE(new Response(bytes).body!);
  expect(await new Response(observed.stream).text()).toBe(bytes);
  const usage = await observed.usage;
  expect(usage).toMatchObject({
    prompt_tokens: 7,
    completion_tokens: 3,
    total_tokens: 10,
  });
  const account = store.saveAccount('codex', {
    accessToken: 'usage-token',
    refreshToken: 'refresh',
    accountKey: 'native-sse-usage',
    email: null,
    expiresAt: Date.now() + 3600000,
  });
  const linked = store.connectGateway(account.id, ['native-usage-model']);
  const { writeRequestLog } = await import('../../lib/gateway/logger');
  writeRequestLog({
    ts: Date.now(),
    providerId: linked.providerId,
    modelId: 'native-usage-model',
    alias: null,
    entryProtocol: 'responses',
    status: 200,
    latencyMs: 1,
    usage,
    error: null,
    stream: true,
  });
  expect(
    sqlite
      .prepare(
        'SELECT prompt_tokens,completion_tokens,total_tokens,cost FROM request_logs WHERE provider_id=?'
      )
      .get(linked.providerId)
  ).toEqual({
    prompt_tokens: 7,
    completion_tokens: 3,
    total_tokens: 10,
    cost: null,
  });
});

const adminPost = async (path: string[], body: unknown, cookie?: string) => {
  const route = await import('../../app/api/admin/subscriptions/[[...path]]/route');
  return route.POST(
    new Request(`http://localhost:3000/api/admin/subscriptions/${path.join('/')}`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ path }) }
  );
};
test('Copilot synced catalogs send responses-only models to /responses and chat models to /chat/completions', async () => {
  const a = store.saveAccount('copilot', {
    accessToken: 'copilot-session',
    refreshToken: 'ghu-refresh',
    accountKey: 'copilot-split',
    email: null,
    expiresAt: Date.now() + 3600000,
    apiBase: 'https://api.individual.githubcopilot.com',
  });
  const synced = store.syncGatewayModels(a.id, {
    models: [
      { id: 'gpt-5.1-codex', displayName: null, endpoints: ['openai-responses'] },
      { id: 'gpt-5.1', displayName: null, endpoints: ['openai'] },
    ],
    skipped: 0,
    source: 'fixture',
    checkedAt: Date.now(),
  });
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      urls.push(url);
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer copilot-session');
      if (url.endsWith('/responses'))
        return Response.json({
          id: 'r1',
          object: 'response',
          status: 'completed',
          model: 'gpt-5.1-codex',
          output: [
            {
              type: 'message',
              id: 'm1',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'from responses' }],
            },
          ],
          usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
        });
      return Response.json({
        id: 'c1',
        object: 'chat.completion',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'from chat' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      });
    })
  );
  const call = (entry: 'openai' | 'responses', model: string) =>
    pipeline({
      entry,
      rawBody:
        entry === 'responses'
          ? { input: 'hi' }
          : { messages: [{ role: 'user', content: 'hi' }] },
      ir: { messages: [{ role: 'user', content: 'hi' }] },
      requestedModel: `${synced.account.providerSlug}/${model}`,
      stream: false,
      includeUsage: true,
      clientSignal: new AbortController().signal,
    });
  const viaChat = await call('openai', 'gpt-5.1-codex');
  expect(viaChat.status).toBe(200);
  expect(JSON.parse(await viaChat.text()).choices[0].message.content).toBe('from responses');
  const viaResponses = await call('responses', 'gpt-5.1');
  expect(viaResponses.status).toBe(200);
  expect(await viaResponses.text()).toContain('from chat');
  expect(urls).toEqual([
    'https://api.individual.githubcopilot.com/responses',
    'https://api.individual.githubcopilot.com/chat/completions',
  ]);
});
test('Copilot device login completes through the poll route and connects every listed model', async () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 1800;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      switch (url) {
        case 'https://github.com/login/device/code':
          return Response.json({ device_code: 'device-secret', user_code: 'WDJB-MJHT', expires_in: 900, interval: 5 });
        case 'https://github.com/login/oauth/access_token':
          return Response.json({ access_token: 'ghu_device', token_type: 'bearer' });
        case 'https://api.github.com/user':
          return Response.json({ id: 90210, login: 'octo' });
        case 'https://api.github.com/copilot_internal/v2/token':
          return Response.json({
            token: 'copilot-session',
            expires_at: expiresAt,
            endpoints: { api: 'https://api.individual.githubcopilot.com' },
          });
        case 'https://api.github.com/copilot_internal/user':
          return Response.json({
            copilot_plan: 'individual',
            quota_reset_date: '2026-10-01',
            quota_snapshots: { premium_interactions: { percent_remaining: 80, unlimited: false } },
          });
        case 'https://api.individual.githubcopilot.com/models':
          return Response.json({
            data: [
              { id: 'gpt-5.1', model_picker_enabled: true, capabilities: { type: 'chat' }, supported_endpoints: ['/chat/completions', '/responses'] },
              { id: 'gpt-5.1-codex', model_picker_enabled: true, capabilities: { type: 'chat' }, supported_endpoints: ['/responses'] },
            ],
          });
      }
      throw new Error(`unexpected upstream ${url}`);
    })
  );
  const start = await adminPost(['oauth'], { vendor: 'copilot' });
  expect(start.status).toBe(201);
  const { session } = await start.json();
  expect(session.kind).toBe('device');
  expect(session.userCode).toBe('WDJB-MJHT');
  expect(JSON.stringify(session)).not.toContain('device-secret');
  const cookie = start.headers.get('set-cookie')!.split(';')[0];
  const done = await adminPost(['oauth', 'poll'], { sessionId: session.id }, cookie);
  expect(done.status).toBe(200);
  const { account } = await done.json();
  expect(account.vendor).toBe('copilot');
  expect(account.providerSlug).toMatch(/^(?:auth|oauth)-copilot-/);
  expect(account.modelCount).toBe(2);
  expect(account.modelsError).toBeNull();
  expect(JSON.stringify(account)).not.toMatch(/ghu_device|copilot-session/);
});
test('a failed model fetch keeps the login and leaves the manual gateway path available', async () => {
  const a = store.saveAccount('claude', {
    accessToken: 'claude-token',
    refreshToken: 'refresh',
    accountKey: 'claude-no-models',
    email: null,
    expiresAt: Date.now() + 3600000,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ type: 'error', error: { type: 'permission_error' } }, { status: 403 })
    )
  );
  const failed = await adminPost([a.id, 'models'], {});
  expect(failed.status).toBe(502);
  const body = await failed.json();
  expect(body.error).toMatch(/模型列表拉取失败/);
  expect(body.account.providerId).toBeNull();
  expect(store.get(a.id)?.authStatus).toBe('ready');
  const manual = await adminPost([a.id, 'gateway'], { models: ['claude-sonnet-4-6'] });
  expect(manual.status).toBe(200);
  expect((await manual.json()).account.modelCount).toBe(1);
});

type Json = Record<string, any>;
const fixtureDiscovery = (models: Json[]) => ({ models: models as any, skipped: 0, source: 'fixture', checkedAt: Date.now() });

test('Antigravity folded models pick the variant from reasoning strength and keep legacy names callable', async () => {
  const a = store.saveAccount('antigravity', {
    accessToken: 'ag-token',
    refreshToken: 'refresh',
    accountKey: 'ag-reasoning',
    email: null,
    expiresAt: Date.now() + 3600000,
    projectId: 'managed-project',
  });
  const synced = store.syncGatewayModels(
    a.id,
    fixtureDiscovery([
      {
        id: 'gemini-3.1-pro',
        displayName: 'Gemini 3.1 Pro',
        endpoints: ['gemini'],
        reasoning: {
          control: 'level',
          variants: { low: 'gemini-3.1-pro-low', high: 'gemini-pro-agent' },
          upstreamDefault: 'gemini-pro-agent',
          legacyIds: ['gemini-3.1-pro-low', 'gemini-pro-agent'],
        },
      },
    ])
  );
  const seen: Json[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      seen.push(JSON.parse(String(init.body)));
      return Response.json({
        response: { candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] },
      });
    })
  );
  const slug = synced.account.providerSlug;
  const call = (model: string, extra: Json = {}) =>
    pipeline({
      entry: 'openai',
      rawBody: { messages: [{ role: 'user', content: 'hi' }], ...extra },
      ir: { messages: [{ role: 'user', content: 'hi' }], ...extra },
      requestedModel: model,
      stream: false,
      includeUsage: false,
      clientSignal: new AbortController().signal,
    });
  expect((await call(`${slug}/gemini-3.1-pro`, { reasoning_effort: 'low' })).status).toBe(200);
  expect((await call(`${slug}/gemini-3.1-pro`)).status).toBe(200);
  expect((await call(`${slug}/gemini-3.1-pro-low`)).status).toBe(200);
  expect((await call(`${slug}/gemini-3.1-pro`, { reasoning_effort: 'medium' })).status).toBe(200);
  expect(seen.map((body) => body.model)).toEqual([
    'gemini-3.1-pro-low',
    'gemini-pro-agent',
    'gemini-3.1-pro-low',
    'gemini-3.1-pro-low',
  ]);
  expect(seen[0].request.generationConfig?.thinkingConfig).toBeUndefined();
  expect(seen[3].request.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'medium' });
  expect(store.listModels(a.id).map((m) => m.modelId)).toEqual(['gemini-3.1-pro']);
});

test('Codex clamps a chat reasoning_effort to the catalog levels on the Responses upstream', async () => {
  const a = store.saveAccount('codex', {
    accessToken: 'codex-token',
    refreshToken: 'refresh',
    accountKey: 'codex-reasoning',
    email: null,
    expiresAt: Date.now() + 3600000,
  });
  const synced = store.syncGatewayModels(
    a.id,
    fixtureDiscovery([
      { id: 'gpt-5.5', displayName: null, endpoints: ['openai-responses'], reasoning: { control: 'level', efforts: ['low', 'medium', 'high', 'xhigh'] } },
    ])
  );
  let upstream: Json = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      upstream = JSON.parse(String(init.body));
      const completed = {
        type: 'response.completed',
        response: {
          id: 'r1',
          status: 'completed',
          output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'ok' }] }],
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      };
      return new Response(`data: ${JSON.stringify(completed)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
    })
  );
  const response = await pipeline({
    entry: 'openai',
    rawBody: { messages: [{ role: 'user', content: 'hi' }], reasoning_effort: 'max' },
    ir: { messages: [{ role: 'user', content: 'hi' }], reasoning_effort: 'max' },
    requestedModel: `${synced.account.providerSlug}/gpt-5.5`,
    stream: false,
    includeUsage: false,
    clientSignal: new AbortController().signal,
  });
  expect(response.status).toBe(200);
  expect(upstream.reasoning).toEqual({ effort: 'xhigh' });
});

test('Copilot prefers /responses for reasoning requests and strips an unsupported chat reasoning_effort', async () => {
  const a = store.saveAccount('copilot', {
    accessToken: 'copilot-reasoning-session',
    refreshToken: 'ghu-refresh',
    accountKey: 'copilot-reasoning',
    email: null,
    expiresAt: Date.now() + 3600000,
    apiBase: 'https://api.individual.githubcopilot.com',
  });
  const synced = store.syncGatewayModels(
    a.id,
    fixtureDiscovery([
      { id: 'gpt-5.1', displayName: null, endpoints: ['openai', 'openai-responses'], reasoning: { control: 'level', efforts: ['low', 'medium', 'high'] } },
      { id: 'claude-sonnet-4.5', displayName: null, endpoints: ['openai'] },
    ])
  );
  const calls: { url: string; body: Json }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      if (url.endsWith('/responses'))
        return Response.json({
          id: 'r1',
          object: 'response',
          status: 'completed',
          model: 'gpt-5.1',
          output: [{ type: 'message', id: 'm1', role: 'assistant', content: [{ type: 'output_text', text: 'ok' }] }],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        });
      return Response.json({
        id: 'c1',
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    })
  );
  const call = (model: string, extra: Json = {}) =>
    pipeline({
      entry: 'openai',
      rawBody: { messages: [{ role: 'user', content: 'hi' }], ...extra },
      ir: { messages: [{ role: 'user', content: 'hi' }], ...extra },
      requestedModel: `${synced.account.providerSlug}/${model}`,
      stream: false,
      includeUsage: false,
      clientSignal: new AbortController().signal,
    });
  expect((await call('gpt-5.1', { reasoning_effort: 'high' })).status).toBe(200);
  expect((await call('claude-sonnet-4.5', { reasoning_effort: 'high' })).status).toBe(200);
  expect((await call('gpt-5.1')).status).toBe(200);
  expect(calls.map((c) => c.url)).toEqual([
    'https://api.individual.githubcopilot.com/responses',
    'https://api.individual.githubcopilot.com/chat/completions',
    'https://api.individual.githubcopilot.com/chat/completions',
  ]);
  expect(calls[0].body.reasoning).toEqual({ effort: 'high' });
  expect('reasoning_effort' in calls[1].body).toBe(false);
});

test('Claude subscriptions receive adaptive thinking and effort converted from a Responses request', async () => {
  const a = store.saveAccount('claude', {
    accessToken: 'claude-reasoning-token',
    refreshToken: 'refresh',
    accountKey: 'claude-reasoning',
    email: null,
    expiresAt: Date.now() + 3600000,
  });
  const linked = store.connectGateway(a.id, ['claude-opus-4-7']);
  let upstream: Json = {};
  let betas = '';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      upstream = JSON.parse(String(init.body));
      betas = new Headers(init.headers).get('anthropic-beta') ?? '';
      return Response.json({
        id: 'msg',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    })
  );
  const response = await pipeline({
    entry: 'responses',
    rawBody: { input: 'hi', reasoning: { effort: 'xhigh' }, temperature: 0.3 },
    ir: { messages: [{ role: 'user', content: 'hi' }], temperature: 0.3 },
    requestedModel: `${linked.providerSlug}/claude-opus-4-7`,
    stream: false,
    includeUsage: true,
    clientSignal: new AbortController().signal,
  });
  expect(response.status).toBe(200);
  expect(upstream.thinking).toEqual({ type: 'adaptive' });
  expect(upstream.output_config).toEqual({ effort: 'xhigh' });
  expect(upstream.temperature).toBeUndefined();
  expect(betas.split(',')).toContain('effort-2025-11-24');
});

test('subscription model routes list without a mutation origin, and patch or delete only owned models', async () => {
  const route = await import('../../app/api/admin/subscriptions/[[...path]]/route');
  const a = store.saveAccount('codex', {
    accessToken: 'route-token',
    refreshToken: 'refresh',
    accountKey: 'route-models',
    email: null,
    expiresAt: Date.now() + 3600000,
  });
  store.connectGateway(a.id, ['gpt-5.5', 'gpt-5.4']);
  const base = `http://localhost:3000/api/admin/subscriptions/${a.id}/models`;
  const list = await route.GET(new Request(base), { params: Promise.resolve({ path: [a.id, 'models'] }) });
  expect(list.status).toBe(200);
  const { models } = await list.json();
  expect(models.map((m: Json) => m.modelId)).toEqual(['gpt-5.4', 'gpt-5.5']);
  const mutate = (method: 'PATCH' | 'DELETE', modelRowId: string, body?: Json, origin = 'http://localhost:3000') =>
    route[method](
      new Request(`${base}/${modelRowId}`, {
        method,
        headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      }),
      { params: Promise.resolve({ path: [a.id, 'models', modelRowId] }) }
    );
  expect((await mutate('PATCH', models[0].id, { enabled: false, input_price: 3 })).status).toBe(400);
  expect((await mutate('PATCH', models[0].id, { enabled: false }, 'https://evil.example')).status).toBe(403);
  const patched = await mutate('PATCH', models[0].id, { enabled: false });
  expect(patched.status).toBe(200);
  expect((await patched.json()).model.enabled).toBe(false);
  expect((await mutate('DELETE', models[1].id)).status).toBe(200);
  expect((await mutate('DELETE', models[1].id)).status).toBe(404);
  expect(store.listModels(a.id).map((m) => m.modelId)).toEqual(['gpt-5.4']);
});
