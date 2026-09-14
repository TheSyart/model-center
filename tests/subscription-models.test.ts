import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSubscriptionModels } from '../lib/subscriptions/models.ts';
import { requestJson, SubscriptionError } from '../lib/subscriptions/oauth.ts';
import type { Credential } from '../lib/subscriptions/types.ts';

const credential: Credential = {
  accessToken: 'session-token',
  refreshToken: 'long-lived-token',
  expiresAt: Date.now() + 3_600_000,
  accountKey: 'account-1',
  email: null,
  projectId: 'managed-project',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
function recorder(respond: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return respond(String(url), init);
  }) as typeof fetch;
  return { calls, fetcher };
}
const header = (init: RequestInit, name: string) =>
  new Headers(init.headers).get(name);

test('Copilot lists picker-enabled chat models from the seat host and maps supported endpoints', async () => {
  const { calls, fetcher } = recorder(() =>
    json({
      data: [
        {
          id: 'gpt-5.1',
          name: 'GPT-5.1',
          model_picker_enabled: true,
          capabilities: { type: 'chat' },
          supported_endpoints: ['/chat/completions', '/responses'],
        },
        {
          id: 'gpt-5.1-codex',
          name: 'GPT-5.1-Codex',
          model_picker_enabled: true,
          capabilities: { type: 'chat' },
          supported_endpoints: ['/responses'],
        },
        { id: 'claude-sonnet-4.5', capabilities: { type: 'chat' } },
        { id: 'gpt-4o-2024-05-13', model_picker_enabled: false, capabilities: { type: 'chat' } },
        { id: 'text-embedding-3-small', capabilities: { type: 'embeddings' } },
        { id: 'o-disabled', policy: { state: 'disabled' }, capabilities: { type: 'chat' } },
        { id: 'messages-only', capabilities: { type: 'chat' }, supported_endpoints: ['/v1/messages'] },
        { id: '../escape', capabilities: { type: 'chat' } },
      ],
    })
  );
  const result = await fetchSubscriptionModels(
    'copilot',
    { ...credential, apiBase: 'https://api.individual.githubcopilot.com' },
    fetcher
  );
  assert.equal(calls[0].url, 'https://api.individual.githubcopilot.com/models');
  assert.equal(header(calls[0].init, 'authorization'), 'Bearer session-token');
  assert.equal(header(calls[0].init, 'copilot-integration-id'), 'vscode-chat');
  assert.equal(header(calls[0].init, 'x-github-api-version'), '2025-10-01');
  assert.deepEqual(result.models, [
    { id: 'claude-sonnet-4.5', displayName: null, endpoints: ['openai'] },
    { id: 'gpt-5.1', displayName: 'GPT-5.1', endpoints: ['openai', 'openai-responses'] },
    { id: 'gpt-5.1-codex', displayName: 'GPT-5.1-Codex', endpoints: ['openai-responses'] },
  ]);
  assert.equal(result.skipped, 5);
  assert.match(result.source, /api\.individual\.githubcopilot\.com/);
});

test('a stored Copilot host outside githubcopilot.com never receives the session token', async () => {
  const { calls, fetcher } = recorder(() => json({ data: [{ id: 'gpt-5.1' }] }));
  await fetchSubscriptionModels(
    'copilot',
    { ...credential, apiBase: 'https://copilot-api.evil.example' },
    fetcher
  );
  assert.equal(calls[0].url, 'https://api.githubcopilot.com/models');
});

test('Codex keeps listed models that the sent client version supports', async () => {
  const { calls, fetcher } = recorder(() =>
    json({
      models: [
        { slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list', supported_in_api: true },
        { slug: 'gpt-5.3-codex-spark', visibility: 'list', supported_in_api: false },
        { slug: 'codex-auto-review', visibility: 'hide' },
        { slug: 'gpt-future', visibility: 'list', minimal_client_version: '9.0.0' },
        { slug: 'gpt-old-ok', minimal_client_version: '0.100.0' },
      ],
    })
  );
  const result = await fetchSubscriptionModels('codex', credential, fetcher);
  assert.equal(
    calls[0].url,
    'https://chatgpt.com/backend-api/codex/models?client_version=0.154.0'
  );
  assert.equal(header(calls[0].init, 'chatgpt-account-id'), 'account-1');
  assert.equal(header(calls[0].init, 'originator'), 'codex_cli_rs');
  assert.equal(header(calls[0].init, 'version'), '0.154.0');
  assert.deepEqual(
    result.models.map((m) => m.id),
    ['gpt-5.3-codex-spark', 'gpt-5.5', 'gpt-old-ok']
  );
  assert.ok(result.models.every((m) => m.endpoints[0] === 'openai-responses'));
  assert.equal(result.skipped, 2);
});

test('Claude pages with after_id and rejects a repeating cursor', async () => {
  const pages: Record<string, unknown> = {
    'https://api.anthropic.com/v1/models?limit=1000': {
      data: [{ id: 'claude-opus-4-6', display_name: 'Claude Opus 4.6' }],
      has_more: true,
      last_id: 'claude-opus-4-6',
    },
    'https://api.anthropic.com/v1/models?limit=1000&after_id=claude-opus-4-6': {
      data: [{ id: 'claude-sonnet-4-6' }],
      has_more: false,
      last_id: 'claude-sonnet-4-6',
    },
  };
  const { calls, fetcher } = recorder((url) => json(pages[url]));
  const result = await fetchSubscriptionModels('claude', credential, fetcher);
  assert.deepEqual(
    result.models.map((m) => [m.id, m.displayName]),
    [
      ['claude-opus-4-6', 'Claude Opus 4.6'],
      ['claude-sonnet-4-6', null],
    ]
  );
  assert.equal(header(calls[0].init, 'authorization'), 'Bearer session-token');
  assert.equal(header(calls[0].init, 'anthropic-beta'), 'oauth-2025-04-20');
  assert.equal(header(calls[0].init, 'x-api-key'), null);
  const loop = recorder(() =>
    json({ data: [{ id: 'claude-x' }], has_more: true, last_id: 'claude-x' })
  );
  await assert.rejects(
    fetchSubscriptionModels('claude', credential, loop.fetcher),
    /格式无效/
  );
});

test('Antigravity reads the model map for the managed project and drops internal or non-chat models', async () => {
  const { calls, fetcher } = recorder(() =>
    json({
      models: {
        'gemini-3-flash': { displayName: 'Gemini 3 Flash', quotaInfo: { remainingFraction: 1 } },
        'claude-sonnet-4-6': { displayName: 'Claude Sonnet 4.6' },
        'gemini-3.1-flash-image': { displayName: 'Image' },
        chat_20706: {},
        'internal-probe': { isInternal: true },
      },
      webSearchModelIds: ['gemini-3-flash'],
    })
  );
  const result = await fetchSubscriptionModels('antigravity', credential, fetcher);
  assert.equal(
    calls[0].url,
    'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
  );
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    project: 'managed-project',
  });
  assert.deepEqual(
    result.models.map((m) => m.id),
    ['claude-sonnet-4-6', 'gemini-3-flash']
  );
  assert.equal(result.skipped, 3);
  await assert.rejects(
    fetchSubscriptionModels('antigravity', { ...credential, projectId: null }, fetcher),
    /托管项目/
  );
});

test('empty catalogs, malformed bodies and legacy vendors are explicit errors', async () => {
  await assert.rejects(
    fetchSubscriptionModels(
      'copilot',
      credential,
      recorder(() =>
        json({ data: [{ id: 'text-embedding-3', capabilities: { type: 'embeddings' } }] })
      ).fetcher
    ),
    /未返回可用模型/
  );
  await assert.rejects(
    fetchSubscriptionModels('codex', credential, recorder(() => json({ unexpected: true })).fetcher),
    /格式无效/
  );
  await assert.rejects(
    fetchSubscriptionModels('gemini', credential, recorder(() => json({})).fetcher),
    /不支持自动拉取/
  );
  await assert.rejects(
    fetchSubscriptionModels(
      'claude',
      credential,
      recorder(() => json({ error: { type: 'permission_error' } }, 403)).fetcher
    ),
    (error: unknown) => error instanceof SubscriptionError && error.status === 403
  );
});

test('model catalogs may exceed the 1 MiB control-plane cap but stay bounded', async () => {
  const large = 'x'.repeat(2 * 1024 * 1024);
  const ok = await fetchSubscriptionModels(
    'codex',
    credential,
    recorder(() => json({ models: [{ slug: 'gpt-5.5', base_instructions: large }] })).fetcher
  );
  assert.equal(ok.models.length, 1);
  const huge = 'x'.repeat(9 * 1024 * 1024);
  await assert.rejects(
    fetchSubscriptionModels(
      'codex',
      credential,
      recorder(() => json({ models: [{ slug: 'gpt-5.5', base_instructions: huge }] })).fetcher
    ),
    /格式无效/
  );
});

test('model listing targets are pinned shapes; lookalike hosts and extra query values are refused', async () => {
  for (const url of [
    'https://api.githubcopilot.com.evil.example/models',
    'https://api.evil.githubcopilot.com/models',
    'https://api.anthropic.com/v1/models?limit=1000&after_id=x&extra=1',
    'https://chatgpt.com/backend-api/codex/models?client_version=9.9.9',
  ])
    await assert.rejects(
      requestJson(url, {}, recorder(() => json({ data: [] })).fetcher),
      (error: unknown) =>
        error instanceof SubscriptionError && error.code === 'invalid_target'
    );
});
