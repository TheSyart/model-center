import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSubscriptionMutation,
  readSubscriptionBody,
  subscriptionResponse,
} from '../lib/subscriptions/http.ts';

test('OAuth mutation accepts same-origin JSON but rejects cross-site and missing origin', () => {
  const request = (headers: Record<string, string>) =>
    new Request('http://localhost:3000/api/admin/subscriptions/oauth', {
      method: 'POST',
      headers,
    });
  assert.doesNotThrow(() =>
    assertSubscriptionMutation(
      request({
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
      })
    )
  );
  for (const headers of [
    { origin: 'https://evil.test', 'content-type': 'application/json' },
    { 'content-type': 'application/json' },
    { origin: 'http://localhost:3000', 'content-type': 'text/plain' },
  ])
    assert.throws(() =>
      assertSubscriptionMutation(request(headers as Record<string, string>))
    );
});
test('body parser refuses oversized JSON and non-objects', async () => {
  for (const body of [
    '[]',
    'null',
    JSON.stringify({ input: 'x'.repeat(17000) }),
    'invalid',
  ])
    await assert.rejects(
      readSubscriptionBody(
        new Request('http://localhost', { method: 'POST', body })
      )
    );
  assert.deepEqual(
    await readSubscriptionBody(
      new Request('http://localhost', {
        method: 'POST',
        body: '{"vendor":"codex"}',
      })
    ),
    { vendor: 'codex' }
  );
});
test('account responses cannot be cached', () => {
  const response = subscriptionResponse({ accounts: [] });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});
test('Next internal localhost URL uses browser Host for origin validation', () => {
  const req = (origin: string, extra: Record<string, string> = {}) =>
    new Request('http://localhost:3112/api/admin/subscriptions/oauth', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3112',
        origin,
        'content-type': 'application/json',
        ...extra,
      },
    });
  assert.doesNotThrow(() =>
    assertSubscriptionMutation(req('http://127.0.0.1:3112'))
  );
  assert.throws(() => assertSubscriptionMutation(req('http://localhost:3112')));
  assert.throws(() =>
    assertSubscriptionMutation(
      req('https://evil.example', { 'x-forwarded-host': 'evil.example' })
    )
  );
  assert.throws(() =>
    assertSubscriptionMutation(
      req('http://127.0.0.1:3112', { 'sec-fetch-site': 'cross-site' })
    )
  );
});

test('configured public HTTPS origin permits proxy deployment and rejects foreign origins', async () => {
  const prior = process.env.MODEL_CENTER_PUBLIC_ORIGIN;
  try {
    process.env.MODEL_CENTER_PUBLIC_ORIGIN = 'https://models.example.com';
    const { subscriptionPublicOrigin } = await import(
      '../lib/subscriptions/http.ts'
    );
    const req = new Request(
      'http://localhost:3000/api/admin/subscriptions/oauth',
      {
        method: 'POST',
        headers: {
          Host: 'models.example.com',
          Origin: 'https://models.example.com',
          'Content-Type': 'application/json',
        },
      }
    );
    assert.equal(subscriptionPublicOrigin(req), 'https://models.example.com');
    assert.doesNotThrow(() => assertSubscriptionMutation(req));
    const evil = new Request(req, {
      headers: {
        Origin: 'https://evil.example',
        'Content-Type': 'application/json',
      },
    });
    assert.throws(() => assertSubscriptionMutation(evil), { status: 403 });
  } finally {
    if (prior === undefined) delete process.env.MODEL_CENTER_PUBLIC_ORIGIN;
    else process.env.MODEL_CENTER_PUBLIC_ORIGIN = prior;
  }
});
test('public origin configuration rejects non-origin and unsafe URL shapes', () => {
  const prior = process.env.MODEL_CENTER_PUBLIC_ORIGIN;
  try {
    for (const value of [
      'not-a-url',
      'https://user:secret@example.com',
      'https://example.com/path',
      'https://example.com/?token=secret',
      'https://example.com/#hash',
      'file:///tmp/local',
    ]) {
      process.env.MODEL_CENTER_PUBLIC_ORIGIN = value;
      assert.throws(
        () =>
          assertSubscriptionMutation(
            new Request('http://localhost', {
              method: 'POST',
              headers: {
                Origin: 'http://localhost',
                'Content-Type': 'application/json',
              },
            })
          ),
        (error: unknown) =>
          error instanceof Error &&
          'status' in error &&
          error.status === 500 &&
          !error.message.includes('secret')
      );
    }
  } finally {
    if (prior === undefined) delete process.env.MODEL_CENTER_PUBLIC_ORIGIN;
    else process.env.MODEL_CENTER_PUBLIC_ORIGIN = prior;
  }
});
test('forwarded headers alone never establish a trusted public origin', async () => {
  const prior = process.env.MODEL_CENTER_PUBLIC_ORIGIN;
  delete process.env.MODEL_CENTER_PUBLIC_ORIGIN;
  try {
    const { subscriptionPublicOrigin } = await import(
      '../lib/subscriptions/http.ts'
    );
    const req = new Request(
      'http://localhost:3000/api/admin/subscriptions/oauth',
      {
        method: 'POST',
        headers: {
          Host: 'localhost:3000',
          Origin: 'https://evil.example',
          'Content-Type': 'application/json',
          'X-Forwarded-Proto': 'https',
          'X-Forwarded-Host': 'evil.example',
          Forwarded: 'host=evil.example;proto=https',
        },
      }
    );
    assert.equal(subscriptionPublicOrigin(req), 'http://localhost:3000');
    assert.throws(() => assertSubscriptionMutation(req), { status: 403 });
  } finally {
    if (prior !== undefined) process.env.MODEL_CENTER_PUBLIC_ORIGIN = prior;
  }
});
