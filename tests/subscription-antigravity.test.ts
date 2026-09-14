import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuthorization,
  parseAuthorizationCode,
  exchangeAuthorization,
  refreshCredential,
} from '../lib/subscriptions/oauth.ts';
import { fetchQuota } from '../lib/subscriptions/quota.ts';
import {
  subscriptionWireRequest,
  normalizeSubscriptionResponse,
} from '../lib/subscriptions/gateway.ts';
const priorId = process.env.ANTIGRAVITY_OAUTH_CLIENT_ID,
  priorSecret = process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET;
process.env.ANTIGRAVITY_OAUTH_CLIENT_ID = 'test-antigravity-client';
process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET = 'test-antigravity-secret';
after(() => {
  for (const [key, value] of [
    ['ANTIGRAVITY_OAUTH_CLIENT_ID', priorId],
    ['ANTIGRAVITY_OAUTH_CLIENT_SECRET', priorSecret],
  ]) {
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  }
});
const credential = {
  accessToken: 'test-access',
  refreshToken: 'test-refresh',
  expiresAt: Date.now() + 3600000,
  accountKey: 'test-google',
  email: 'test@example.test',
  projectId: 'managed-project',
};
const token = {
  access_token: 'test-access',
  refresh_token: 'test-refresh',
  expires_in: 3600,
};
test('Antigravity uses its own client, scopes and state-bound loopback callback', () => {
  const auth = createAuthorization('antigravity');
  const url = new URL(auth.url);
  assert.equal(url.searchParams.get('client_id'), 'test-antigravity-client');
  assert.equal(auth.redirectUri, 'http://localhost:51121/oauth-callback');
  assert.ok(
    url.searchParams.get('scope')!.includes('/auth/experimentsandconfigs')
  );
  assert.equal(
    parseAuthorizationCode(
      auth,
      `${auth.redirectUri}?code=test-code&state=${auth.state}`
    ),
    'test-code'
  );
  assert.throws(() =>
    parseAuthorizationCode(auth, `${auth.redirectUri}?code=x&state=wrong`)
  );
  assert.throws(() => parseAuthorizationCode(auth, 'raw-code'));
});
test('Antigravity exchanges with isolated credentials and discovers object-shaped projects', async () => {
  const result = await exchangeAuthorization(
    createAuthorization('antigravity'),
    'test-code',
    undefined,
    async (url, init) => {
      if (String(url).endsWith('/token')) {
        const body = new URLSearchParams(String(init?.body));
        assert.equal(body.get('client_id'), 'test-antigravity-client');
        assert.equal(body.get('client_secret'), 'test-antigravity-secret');
        return Response.json(token);
      }
      if (String(url).includes('userinfo'))
        return Response.json({ id: 'test-google', email: 'test@example.test' });
      assert.equal(
        JSON.parse(String(init?.body)).metadata.ideType,
        'ANTIGRAVITY'
      );
      return Response.json({
        cloudaicompanionProject: { id: 'managed-project' },
        paidTier: { name: 'Pro' },
      });
    }
  );
  assert.equal(result.projectId, 'managed-project');
  assert.equal(result.plan, 'Pro');
  const refreshed = await refreshCredential(
    'antigravity',
    credential,
    async (url, init) => {
      assert.equal(
        new URLSearchParams(String(init?.body)).get('client_id'),
        'test-antigravity-client'
      );
      return Response.json({ ...token, refresh_token: 'rotated' });
    }
  );
  assert.equal(refreshed.refreshToken, 'rotated');
});
test('Antigravity onboards on daily with native metadata when no project was discovered', async () => {
  const result = await exchangeAuthorization(
    createAuthorization('antigravity'),
    'test-code',
    undefined,
    async (url, init) => {
      if (String(url).endsWith('/token')) return Response.json(token);
      if (String(url).includes('userinfo'))
        return Response.json({ id: 'test-google' });
      if (String(url).endsWith(':loadCodeAssist'))
        return Response.json({
          allowedTiers: [{ id: 'free-tier', isDefault: true }],
          ineligibleTiers: [
            { reasonCode: 'INELIGIBLE_ACCOUNT', tierId: 'another-tier' },
          ],
        });
      assert.equal(
        String(url),
        'https://daily-cloudcode-pa.googleapis.com/v1internal:onboardUser'
      );
      assert.equal(
        JSON.parse(String(init?.body)).metadata.ide_type,
        'ANTIGRAVITY'
      );
      return Response.json({
        done: true,
        response: { cloudaicompanionProject: { id: 'managed-project' } },
      });
    }
  );
  assert.equal(result.projectId, 'managed-project');
});
test('Antigravity quota preserves model groups, zero, unknown and explicit windows', async () => {
  const result = await fetchQuota(
    'antigravity',
    credential,
    async (url, init) => {
      assert.equal(
        String(url),
        'https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary'
      );
      assert.equal(JSON.parse(String(init?.body)).project, 'managed-project');
      return Response.json({
        groups: [
          {
            displayName: 'Gemini Models',
            buckets: [
              {
                bucketId: 'five',
                window: '5h',
                remainingFraction: 0,
                resetTime: '2026-09-14T20:00:00Z',
              },
              {
                bucketId: 'week',
                window: 'weekly',
                remaining_fraction: '0.25',
              },
            ],
          },
          {
            display_name: 'Claude and GPT models',
            buckets: [{ bucket_id: 'unknown', remainingFraction: null }],
          },
        ],
      });
    }
  );
  assert.equal(result.windows.length, 3);
  assert.equal(result.windows[0].remainingPercent, 0);
  assert.equal(result.windows[0].windowSeconds, 18000);
  assert.equal(result.windows[1].remainingPercent, 25);
  assert.equal(result.windows[1].windowSeconds, 604800);
  assert.equal(result.windows[2].remainingPercent, null);
});
for (const stream of [false, true])
  test(`Antigravity wire and response envelope (${stream ? 'SSE' : 'JSON'})`, async () => {
    const wire = subscriptionWireRequest(
      'antigravity',
      credential,
      {
        url: 'ignored',
        headers: {},
        body: { contents: [{ role: 'user', parts: [{ text: 'hello' }] }] },
      },
      'gemini-test',
      stream
    );
    assert.ok(
      wire.url.startsWith(
        'https://daily-cloudcode-pa.googleapis.com/v1internal:'
      )
    );
    const body = wire.body as any;
    assert.equal(body.userAgent, 'antigravity');
    assert.equal(body.requestType, 'agent');
    assert.equal(body.project, 'managed-project');
    assert.ok(body.request.sessionId);
    assert.ok(body.requestId.startsWith('agent-'));
    const payload = {
      response: {
        candidates: [
          { content: { parts: [{ text: 'hello' }] }, finishReason: 'STOP' },
        ],
      },
    };
    const result = await normalizeSubscriptionResponse(
      'antigravity',
      new Response(
        stream
          ? `data: ${JSON.stringify(payload)}\n\n`
          : JSON.stringify(payload)
      ),
      stream
    );
    assert.ok((await result.text()).includes('candidates'));
  });

test('Antigravity missing configuration never falls back to the Gemini client', () => {
  const secret = process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET;
  delete process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET;
  try {
    assert.throws(
      () => createAuthorization('antigravity'),
      /ANTIGRAVITY_OAUTH_CLIENT_SECRET/
    );
  } finally {
    process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET = secret;
  }
});
test('Antigravity quota rejects malformed groups and preserves invalid amounts as unknown', async () => {
  await assert.rejects(
    fetchQuota('antigravity', credential, async () =>
      Response.json({ buckets: [] })
    ),
    /额度分组/
  );
  const result = await fetchQuota('antigravity', credential, async () =>
    Response.json({
      groups: [
        {
          buckets: [
            { remainingFraction: 2 },
            { remainingFraction: -1 },
            { remainingFraction: '' },
          ],
        },
      ],
    })
  );
  assert.ok(result.windows.every((w) => w.remainingPercent === null));
});
test('Antigravity onboarding obeys cancellation instead of resubmitting a consumed code', async () => {
  const controller = new AbortController();
  let onboards = 0;
  await assert.rejects(
    exchangeAuthorization(
      createAuthorization('antigravity'),
      'test-code',
      undefined,
      async (url) => {
        if (String(url).endsWith('/token')) return Response.json(token);
        if (String(url).includes('userinfo'))
          return Response.json({ id: 'test-google' });
        if (String(url).endsWith(':loadCodeAssist')) return Response.json({});
        onboards++;
        setTimeout(() => controller.abort(), 20);
        return Response.json({ done: false });
      },
      controller.signal
    ),
    /操作已取消/
  );
  assert.equal(onboards, 1);
});
