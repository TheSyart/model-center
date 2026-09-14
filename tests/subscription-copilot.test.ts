import test from 'node:test';
import assert from 'node:assert/strict';
import {
  copilotApiBase,
  createDeviceAuthorization,
  pollDeviceAuthorization,
  refreshCredential,
  SubscriptionError,
} from '../lib/subscriptions/oauth.ts';
import type { Credential } from '../lib/subscriptions/types.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const inHalfHour = () => Math.floor(Date.now() / 1000) + 1800;
const header = (init: RequestInit, name: string) =>
  new Headers(init.headers).get(name);
function github(routes: Record<string, (init: RequestInit) => Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const route = routes[String(url)];
    if (!route) throw new Error(`unexpected upstream ${String(url)}`);
    return route(init);
  }) as typeof fetch;
  return { calls, fetcher };
}
const deviceStart = (body: Record<string, unknown>) =>
  github({ 'https://github.com/login/device/code': () => json(body) }).fetcher;

test('Copilot device login uses the public client id and the pinned verification page', async () => {
  const { calls, fetcher } = github({
    'https://github.com/login/device/code': () =>
      json({
        device_code: 'device-secret',
        user_code: 'ABCD-1234',
        verification_uri: 'https://evil.example/device',
        expires_in: 900,
        interval: 1,
      }),
  });
  const auth = await createDeviceAuthorization('copilot', fetcher);
  assert.equal(auth.kind, 'device');
  assert.equal(auth.url, 'https://github.com/login/device');
  assert.equal(auth.device?.userCode, 'ABCD-1234');
  assert.equal(auth.device?.intervalMs, 3000);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    client_id: 'Iv1.b507a08c87ecfe98',
    scope: 'read:user',
  });
});

test('Copilot device polling distinguishes pending, slow_down, expiry and denial', async () => {
  const auth = await createDeviceAuthorization(
    'copilot',
    deviceStart({ device_code: 'device', user_code: 'CODE', interval: 5 })
  );
  const poll = (body: unknown) =>
    pollDeviceAuthorization(
      auth,
      github({ 'https://github.com/login/oauth/access_token': () => json(body) }).fetcher
    );
  assert.deepEqual(await poll({ error: 'authorization_pending' }), {
    status: 'pending',
    retryAfterMs: 5000,
  });
  assert.deepEqual(await poll({ error: 'slow_down' }), {
    status: 'pending',
    retryAfterMs: 10000,
  });
  await assert.rejects(
    poll({ error: 'expired_token' }),
    (error: unknown) => error instanceof SubscriptionError && error.status === 410
  );
  await assert.rejects(poll({ error: 'access_denied' }), /拒绝/);
});

test('an approved device code yields the GitHub identity, a Copilot session and the seat host', async () => {
  const auth = await createDeviceAuthorization(
    'copilot',
    deviceStart({ device_code: 'device', user_code: 'CODE' })
  );
  const { calls, fetcher } = github({
    'https://github.com/login/oauth/access_token': () =>
      json({ access_token: 'ghu_user', token_type: 'bearer' }),
    'https://api.github.com/user': () => json({ id: 42, login: 'octo', email: null }),
    'https://api.github.com/copilot_internal/v2/token': () =>
      json({
        token: 'tid=session',
        expires_at: inHalfHour(),
        refresh_in: 1500,
        endpoints: { api: 'https://api.individual.githubcopilot.com' },
      }),
  });
  const result = await pollDeviceAuthorization(auth, fetcher);
  assert.equal(result.status, 'complete');
  const credential = (result as { credential: Credential }).credential;
  assert.equal(credential.accountKey, '42');
  assert.equal(credential.email, 'octo');
  assert.equal(credential.refreshToken, 'ghu_user');
  assert.equal(credential.accessToken, 'tid=session');
  assert.equal(credential.apiBase, 'https://api.individual.githubcopilot.com');
  const session = calls.find((call) => call.url.endsWith('/v2/token'))!;
  assert.equal(header(session.init, 'authorization'), 'token ghu_user');
  assert.equal(header(session.init, 'editor-version'), 'vscode/1.110.1');
  assert.equal(header(session.init, 'editor-plugin-version'), 'copilot-chat/0.38.2');
});

test('Copilot session refresh names a missing seat, keeps seat hosts and refuses unknown hosts', async () => {
  const stored: Credential = {
    accessToken: 'old-session',
    refreshToken: 'ghu_user',
    expiresAt: 0,
    accountKey: '42',
    email: 'octo',
  };
  const session = (respond: () => Response) =>
    github({ 'https://api.github.com/copilot_internal/v2/token': respond }).fetcher;
  await assert.rejects(
    refreshCredential('copilot', stored, session(() => json({ message: 'Forbidden' }, 403))),
    /没有可用的 Copilot 订阅/
  );
  await assert.rejects(
    refreshCredential('copilot', stored, session(() => json({ message: 'Bad credentials' }, 401))),
    (error: unknown) => error instanceof SubscriptionError && error.code === 'needs_reauth'
  );
  await assert.rejects(
    refreshCredential(
      'copilot',
      stored,
      session(() =>
        json({
          token: 'session',
          expires_at: inHalfHour(),
          endpoints: { api: 'https://copilot-api.ghe.example' },
        })
      )
    ),
    (error: unknown) =>
      error instanceof SubscriptionError && error.code === 'unsupported_account'
  );
  const personal = await refreshCredential(
    'copilot',
    stored,
    session(() => json({ token: 'session', expires_at: inHalfHour() }))
  );
  assert.equal(personal.apiBase, 'https://api.githubcopilot.com');
  assert.equal(personal.accountKey, '42');
  const business = await refreshCredential(
    'copilot',
    stored,
    session(() =>
      json({
        token: 'session',
        expires_at: inHalfHour(),
        endpoints: { api: 'https://api.business.githubcopilot.com/' },
      })
    )
  );
  assert.equal(business.apiBase, 'https://api.business.githubcopilot.com');
  assert.equal(
    copilotApiBase({ apiBase: 'https://api.githubcopilot.com.evil.example' }),
    'https://api.githubcopilot.com'
  );
});
