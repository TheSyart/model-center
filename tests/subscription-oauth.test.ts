import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createAuthorization,
  parseAuthorizationCode,
  exchangeAuthorization,
  refreshCredential,
  requestJson,
  SubscriptionError,
} from '../lib/subscriptions/oauth.ts';
import type { Credential } from '../lib/subscriptions/types.ts';
const priorClientId = process.env.GEMINI_OAUTH_CLIENT_ID;
const priorClientSecret = process.env.GEMINI_OAUTH_CLIENT_SECRET;
process.env.GEMINI_OAUTH_CLIENT_ID = 'fixture-google-client';
process.env.GEMINI_OAUTH_CLIENT_SECRET = 'fixture-google-secret';
after(() => {
  if (priorClientId === undefined) delete process.env.GEMINI_OAUTH_CLIENT_ID;
  else process.env.GEMINI_OAUTH_CLIENT_ID = priorClientId;
  if (priorClientSecret === undefined)
    delete process.env.GEMINI_OAUTH_CLIENT_SECRET;
  else process.env.GEMINI_OAUTH_CLIENT_SECRET = priorClientSecret;
});
const credential: Credential = {
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  expiresAt: 1,
  accountKey: 'account',
  email: 'user@example.com',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const token = {
  access_token: 'new-access',
  refresh_token: 'new-refresh',
  expires_in: 3600,
};
const jwt = (body: unknown) =>
  'header.' +
  Buffer.from(JSON.stringify(body)).toString('base64url') +
  '.signature';
test('PKCE and exact callback/state boundary', () => {
  for (const vendor of ['claude', 'codex', 'gemini'] as const) {
    const auth = createAuthorization(vendor);
    const url = new URL(auth.url);
    assert.equal(
      url.searchParams.get('code_challenge'),
      createHash('sha256').update(auth.verifier).digest('base64url')
    );
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.notEqual(auth.state, createAuthorization(vendor).state);
    if (vendor === 'gemini') {
      assert.equal(
        parseAuthorizationCode(auth, '  pasted-code  '),
        'pasted-code'
      );
      continue;
    }
    assert.equal(
      parseAuthorizationCode(
        auth,
        `${auth.redirectUri}?code=abc&state=${auth.state}`
      ),
      'abc'
    );
    for (const input of [
      `${auth.redirectUri}?code=abc&state=wrong`,
      `${auth.redirectUri}/evil?code=abc&state=${auth.state}`,
      `${auth.redirectUri}?code=a&code=b&state=${auth.state}`,
      `${auth.redirectUri}?error=access_denied&state=${auth.state}`,
      'abc',
    ])
      assert.throws(() => parseAuthorizationCode(auth, input));
  }
});
test('Codex identity comes only from official token exchange; absent identity rejects', async () => {
  const auth = createAuthorization('codex');
  const result = await exchangeAuthorization(
    auth,
    'code',
    undefined,
    async (url, init) => {
      assert.equal(String(url), 'https://auth.openai.com/oauth/token');
      assert.equal(init?.redirect, 'error');
      return json({
        ...token,
        id_token: jwt({
          email: 'u@example.com',
          'https://api.openai.com/auth': { chatgpt_account_id: 'workspace' },
        }),
      });
    }
  );
  assert.equal(result.accountKey, 'workspace');
  await assert.rejects(
    exchangeAuthorization(auth, 'code', undefined, async () => json(token)),
    { code: 'invalid_identity' }
  );
});
test('refresh retains identity and omitted refresh token; invalid grant and temporary errors are sanitized', async () => {
  const next = await refreshCredential('codex', credential, async () =>
    json({ access_token: 'next', expires_in: 3600 })
  );
  assert.equal(next.refreshToken, credential.refreshToken);
  assert.equal(next.accountKey, credential.accountKey);
  for (const [status, error, code] of [
    [400, 'invalid_grant', 'needs_reauth'],
    [429, 'sensitive-token', 'retryable'],
    [503, 'secret', 'retryable'],
  ] as const) {
    await assert.rejects(
      refreshCredential('codex', credential, async () =>
        json({ error, error_description: 'secret-private' }, status)
      ),
      (err: any) => err.code === code && !err.message.includes('secret')
    );
  }
  await assert.rejects(
    refreshCredential('codex', credential, async () =>
      json({ ...token, access_token: 'bad\ntoken' })
    ),
    { code: 'invalid_response' }
  );
});
test('Claude profile completes identity omitted from token response', async () => {
  const result = await exchangeAuthorization(
    createAuthorization('claude'),
    'code',
    undefined,
    async (url) =>
      String(url).endsWith('/token')
        ? json(token)
        : json({
            account: { uuid: 'claude-id', email: 'c@example.com' },
            organization: { uuid: 'org' },
          })
  );
  assert.equal(result.accountKey, 'claude-id');
  assert.equal(result.organizationId, 'org');
});
test('Gemini free onboarding omits project, polls operation once and retains quota project', async () => {
  const urls: string[] = [];
  const result = await exchangeAuthorization(
    createAuthorization('gemini'),
    'code',
    'my-project',
    async (url, init) => {
      urls.push(String(url));
      if (String(url).includes('/token')) return json(token);
      if (String(url).includes('/userinfo'))
        return json({ id: 'google-id', email: 'g@example.com' });
      if (String(url).endsWith(':loadCodeAssist'))
        return json({ allowedTiers: [{ id: 'free-tier', isDefault: true }] });
      if (String(url).endsWith(':onboardUser')) {
        assert.equal(
          JSON.parse(String(init?.body)).cloudaicompanionProject,
          undefined
        );
        return json({ name: 'operations/test', done: false });
      }
      assert.equal(
        String(url),
        'https://cloudcode-pa.googleapis.com/v1internal/operations/test'
      );
      return json({
        done: true,
        response: { cloudaicompanionProject: { id: 'managed-project' } },
      });
    }
  );
  assert.equal(result.projectId, 'managed-project');
  assert.equal(result.accountKey, 'google-id');
  assert.equal(urls.filter((url) => url.endsWith(':onboardUser')).length, 1);
});
test('network boundary rejects nonofficial URL, oversized body and cancellation', async () => {
  await assert.rejects(
    requestJson('https://evil.example/token', {}, async () => json({})),
    { code: 'invalid_target' }
  );
  await assert.rejects(
    requestJson(
      'https://auth.openai.com/oauth/token',
      {},
      async () => new Response('x'.repeat(1024 * 1024 + 1))
    ),
    { code: 'invalid_response' }
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    requestJson(
      'https://auth.openai.com/oauth/token',
      {},
      fetch,
      controller.signal
    ),
    { code: 'cancelled' }
  );
});
test('Gemini rejects missing project for standard tier and unsafe operation names', async () => {
  const run = (load: unknown, operation: unknown) =>
    exchangeAuthorization(
      createAuthorization('gemini'),
      'code',
      undefined,
      async (url) => {
        if (String(url).includes('/token')) return json(token);
        if (String(url).includes('/userinfo')) return json({ id: 'google-id' });
        return String(url).endsWith(':loadCodeAssist')
          ? json(load)
          : json(operation);
      }
    );
  await assert.rejects(run({ currentTier: { id: 'standard-tier' } }, {}), {
    code: 'project_required',
  });
  await assert.rejects(
    run(
      { allowedTiers: [{ id: 'free-tier', isDefault: true }] },
      { name: '../token', done: false }
    ),
    { code: 'invalid_response' }
  );
});
test('Gemini reports upstream eligibility reasons instead of asking personal users for a project', async () => {
  for (const currentTier of [undefined, { id: 'standard-tier' }]) {
    await assert.rejects(
      exchangeAuthorization(createAuthorization('gemini'), 'code', undefined, async (url) => {
        if (String(url).includes('/token')) return json(token);
        if (String(url).includes('/userinfo')) return json({ id: 'google-id' });
        if (String(url).endsWith(':loadCodeAssist')) return json({
          currentTier,
          ineligibleTiers: [{ reasonCode: 'UNSUPPORTED_LOCATION', reasonMessage: 'Location is not supported.' }],
        });
        return json({ done: true, response: {} });
      }),
      (error: unknown) => error instanceof SubscriptionError &&
        error.code === 'ineligible_account' && error.status === 403 &&
        error.message.includes('UNSUPPORTED_LOCATION') && !error.message.includes('项目 ID')
    );
  }
});

test('Gemini allows Google to onboard a default non-free tier without a supplied project', async () => {
  let onboarded = false;
  const result = await exchangeAuthorization(createAuthorization('gemini'), 'code', undefined, async (url, init) => {
    if (String(url).includes('/token')) return json(token);
    if (String(url).includes('/userinfo')) return json({ id: 'google-id' });
    if (String(url).endsWith(':loadCodeAssist')) return json({
      allowedTiers: [{ id: 'legacy-tier', isDefault: true }],
    });
    assert.ok(String(url).endsWith(':onboardUser'));
    assert.equal(JSON.parse(String(init?.body)).cloudaicompanionProject, undefined);
    onboarded = true;
    return json({ done: true, response: { cloudaicompanionProject: { id: 'managed-project' } } });
  });
  assert.equal(onboarded, true);
  assert.equal(result.projectId, 'managed-project');
});
test('Gemini cancellation interrupts outstanding onboarding poll', async () => {
  const controller = new AbortController();
  const promise = exchangeAuthorization(
    createAuthorization('gemini'),
    'code',
    undefined,
    async (url) => {
      if (String(url).includes('/token')) return json(token);
      if (String(url).includes('/userinfo')) return json({ id: 'google-id' });
      if (String(url).endsWith(':loadCodeAssist'))
        return json({ allowedTiers: [{ id: 'free-tier', isDefault: true }] });
      queueMicrotask(() => controller.abort());
      return json({ name: 'operations/test', done: false });
    },
    controller.signal
  );
  await assert.rejects(promise, { code: 'cancelled' });
});
test('request deadline bounds stalled fetch and stalled response body', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = requestJson(
    'https://auth.openai.com/oauth/token',
    {},
    async () => new Promise<Response>(() => {})
  );
  const assertion = assert.rejects(pending, { code: 'retryable', status: 504 });
  context.mock.timers.tick(20_001);
  await assertion;
  const body = requestJson(
    'https://auth.openai.com/oauth/token',
    {},
    async () => new Response(new ReadableStream({ start() {} }))
  );
  const bodyAssertion = assert.rejects(body, {
    code: 'retryable',
    status: 504,
  });
  context.mock.timers.tick(20_001);
  await bodyAssertion;
});
test('refresh accepts rotated refresh token and rejects omitted access token or expiry', async () => {
  const rotated = await refreshCredential('gemini', credential, async () =>
    json(token)
  );
  assert.equal(rotated.refreshToken, 'new-refresh');
  for (const malformed of [
    { refresh_token: 'x', expires_in: 3600 },
    { access_token: 'x' },
    { ...token, expires_in: '3600' },
    { ...token, refresh_token: '' },
  ])
    await assert.rejects(
      refreshCredential('codex', credential, async () => json(malformed)),
      { code: 'invalid_response' }
    );
});
test('authorization URLs carry provider-specific native login flags', () => {
  assert.equal(
    new URL(createAuthorization('claude').url).searchParams.get('code'),
    'true'
  );
  assert.equal(
    new URL(createAuthorization('codex').url).searchParams.get('prompt'),
    'login'
  );
});
test('deadline cancels stalled body reader rather than leaving a read behind', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let cancelled = false;
  const pending = requestJson(
    'https://auth.openai.com/oauth/token',
    {},
    async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        })
      )
  );
  const assertion = assert.rejects(pending, { code: 'retryable' });
  await Promise.resolve();
  await Promise.resolve();
  context.mock.timers.tick(20_001);
  await assertion;
  assert.equal(cancelled, true);
});

test('Gemini missing deployment configuration fails explicitly without affecting other vendors', () => {
  const secret = process.env.GEMINI_OAUTH_CLIENT_SECRET;
  delete process.env.GEMINI_OAUTH_CLIENT_SECRET;
  try {
    assert.throws(
      () => createAuthorization('gemini'),
      (error: any) =>
        error.code === 'configuration_required' && error.status === 503
    );
    assert.ok(createAuthorization('claude').url);
    assert.ok(createAuthorization('codex').url);
  } finally {
    process.env.GEMINI_OAUTH_CLIENT_SECRET = secret;
  }
});
test('Gemini client configuration comes from environment and secret only goes to token endpoint', async () => {
  const auth = createAuthorization('gemini');
  assert.equal(
    new URL(auth.url).searchParams.get('client_id'),
    'fixture-google-client'
  );
  assert.ok(!JSON.stringify(auth).includes('fixture-google-secret'));
  await refreshCredential('gemini', credential, async (url, init) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get('client_id'), 'fixture-google-client');
    assert.equal(body.get('client_secret'), 'fixture-google-secret');
    return json(token);
  });
});
