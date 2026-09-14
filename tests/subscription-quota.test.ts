import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchQuota } from '../lib/subscriptions/quota.ts';
const credential = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: 1,
  accountKey: 'account',
  email: null,
  projectId: 'project',
};
const fetchJson =
  (data: unknown): typeof fetch =>
  async () =>
    new Response(JSON.stringify(data));
test('Claude keeps explicit zero, unknown and named model windows', async () => {
  const q = await fetchQuota(
    'claude',
    credential,
    fetchJson({
      five_hour: { utilization: 0, resets_at: '2026-09-14T10:00:00Z' },
      seven_day: { utilization: '' },
      seven_day_sonnet: { utilization: 100 },
      limits: [
        {
          kind: 'weekly_scoped',
          percent: 25,
          scope: { model: { display_name: 'Fable' } },
        },
      ],
    })
  );
  assert.equal(q.windows[0].remainingPercent, 100);
  assert.equal(q.windows[0].resetAt, Date.parse('2026-09-14T10:00:00Z'));
  assert.equal(q.windows[1].usedPercent, null);
  assert.equal(q.windows[2].remainingPercent, 0);
  assert.equal(q.windows[3].usedPercent, 25);
});
test('Codex reads actual window duration and includes review and additional limits', async () => {
  const q = await fetchQuota(
    'codex',
    credential,
    fetchJson({
      plan_type: 'plus',
      rate_limit: {
        primary_window: {
          used_percent: 25,
          limit_window_seconds: 18000,
          reset_at: 1800000000,
        },
        secondary_window: { used_percent: null, limit_window_seconds: 86400 },
      },
      code_review_rate_limit: { primary_window: { used_percent: 0 } },
      additional_rate_limits: [
        {
          limit_name: 'extra',
          rate_limit: { primary_window: { used_percent: 150 } },
        },
      ],
    })
  );
  assert.equal(q.windows.length, 4);
  assert.equal(q.windows[0].resetAt, 1800000000000);
  assert.equal(q.windows[1].windowSeconds, 86400);
  assert.equal(q.windows[1].usedPercent, null);
  assert.equal(q.windows[2].remainingPercent, 100);
  assert.equal(q.windows[3].usedPercent, null);
});
test('Gemini fractions zero and absent differ; token types preserve separate bucket identities', async () => {
  const q = await fetchQuota('gemini', credential, async (url, init) => {
    assert.equal(
      String(url),
      'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota'
    );
    assert.deepEqual(JSON.parse(String(init?.body)), { project: 'project' });
    return fetchJson({
      buckets: [
        { modelId: 'gemini', tokenType: 'input', remainingFraction: 0 },
        { modelId: 'gemini', tokenType: 'output', remainingAmount: '0' },
        { remainingFraction: 1 },
        { remainingFraction: '0.5' },
      ],
    })(url, init);
  });
  assert.equal(q.windows[0].remainingPercent, 0);
  assert.equal(q.windows[1].remainingPercent, null);
  assert.notEqual(q.windows[0].id, q.windows[1].id);
  assert.equal(q.windows[2].remainingPercent, 100);
  assert.equal(q.windows[3].remainingPercent, null);
  assert.ok(q.windows.every((w) => w.windowSeconds === null));
});
test('malformed payload and unauthorized upstream fail without leaking body', async () => {
  await assert.rejects(fetchQuota('codex', credential, fetchJson({})), {
    code: 'invalid_response',
  });
  await assert.rejects(
    fetchQuota(
      'claude',
      credential,
      async () => new Response('private-token', { status: 401 })
    ),
    (e: any) => e.status === 401 && !e.message.includes('private')
  );
});
test('quota normalization rejects truncated oversized collections', async () => {
  await assert.rejects(
    fetchQuota(
      'gemini',
      credential,
      fetchJson({
        buckets: Array.from({ length: 501 }, () => ({ remainingFraction: 1 })),
      })
    ),
    { code: 'invalid_response' }
  );
});
test('Claude scoped Fable limit replaces legacy alias without duplicate windows', async () => {
  const q = await fetchQuota(
    'claude',
    credential,
    fetchJson({
      iguana_necktie: { utilization: 90 },
      limits: [
        {
          kind: 'weekly_scoped',
          is_active: false,
          percent: 100,
          scope: { model: { display_name: 'Fable' } },
        },
        {
          kind: 'weekly_scoped',
          is_active: true,
          percent: 10,
          scope: { model: { display_name: 'Fable' } },
        },
      ],
    })
  );
  assert.equal(q.windows.length, 1);
  assert.equal(q.windows[0].usedPercent, 10);
});
