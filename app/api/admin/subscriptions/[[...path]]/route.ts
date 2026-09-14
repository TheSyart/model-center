import crypto from 'node:crypto';
import {
  subscriptionStore as store,
  subscriptionLifecycle as lifecycle,
} from '@/lib/subscriptions/runtime';
import {
  createAuthorization,
  createDeviceAuthorization,
  parseAuthorizationCode,
  exchangeAuthorization,
  pollDeviceAuthorization,
  SubscriptionError,
} from '@/lib/subscriptions/oauth';
import { StoreError } from '@/lib/subscriptions/store';
import {
  assertSubscriptionMutation,
  subscriptionPublicOrigin,
  readSubscriptionBody,
  subscriptionResponse as json,
} from '@/lib/subscriptions/http';
import type {
  Credential,
  SubscriptionVendor,
} from '@/lib/subscriptions/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const COOKIE = 'mc_subscription_owner';
function ownerCookie(req: Request) {
  const value = req.headers
    .get('cookie')
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

/** Shared by the paste and device paths. Login, quota and model sync are independent:
 * a quota or model-list failure is recorded on the account and never undoes the login.
 * A successful model sync connects the gateway with every listed model. */
async function finishLogin(
  vendor: SubscriptionVendor,
  credential: Credential,
  reconnectId: string | undefined
) {
  const account = store.saveAccount(vendor, credential, reconnectId);
  await lifecycle.quota(account.id);
  await lifecycle.models(account.id);
  return json({ account: store.get(account.id) });
}

async function handle(
  req: Request,
  context: { params: Promise<{ path?: string[] }> }
) {
  try {
    const parts = (await context.params).path ?? [];
    if (req.method === 'GET' && !parts.length)
      return json({ accounts: store.list() });
    // Read-only listing: handled before the mutation guard, which a same-origin GET cannot satisfy.
    if (req.method === 'GET' && parts.length === 2 && parts[1] === 'models') {
      if (!store.get(parts[0])) throw new StoreError('账号不存在', 404);
      return json({ models: store.listModels(parts[0]) });
    }
    assertSubscriptionMutation(req);
    const body = req.method === 'DELETE' ? {} : await readSubscriptionBody(req);
    if (parts[0] === 'oauth' && parts.length === 1 && req.method === 'POST') {
      if (body.vendor === 'gemini')
        throw new StoreError('Gemini CLI 登录已停用，请使用 Antigravity CLI 重新授权；两者凭据不能混用。', 410);
      if (
        !['claude', 'codex', 'antigravity', 'copilot'].includes(
          String(body.vendor)
        )
      )
        throw new StoreError('请选择支持的账号厂商');
      if (
        body.projectId !== undefined &&
        (typeof body.projectId !== 'string' ||
          !/^[a-zA-Z0-9:._-]{1,128}$/.test(body.projectId))
      )
        throw new StoreError('Google 项目 ID 格式不正确');
      if (
        body.reconnectId !== undefined &&
        typeof body.reconnectId !== 'string'
      )
        throw new StoreError('账号 ID 无效');
      const owner = ownerCookie(req) ?? crypto.randomBytes(32).toString('hex');
      const vendor = body.vendor as SubscriptionVendor;
      // Copilot has no browser redirect; GitHub only issues device codes for it.
      const authorization =
        vendor === 'copilot'
          ? await createDeviceAuthorization(vendor, undefined, req.signal)
          : createAuthorization(vendor);
      const session = store.createSession(
        authorization,
        owner,
        body.projectId as string | undefined,
        body.reconnectId as string | undefined,
        authorization.device
          ? authorization.device.expiresAt - Date.now() + 60_000
          : undefined
      );
      return json({ session }, 201, {
        'Set-Cookie': `${COOKIE}=${owner}; HttpOnly; SameSite=Strict; Path=/api/admin/subscriptions; Max-Age=86400${subscriptionPublicOrigin(req).startsWith('https://') ? '; Secure' : ''}`,
      });
    }
    if (
      parts[0] === 'oauth' &&
      parts[1] === 'complete' &&
      parts.length === 2 &&
      req.method === 'POST'
    ) {
      const owner = ownerCookie(req);
      if (!owner) throw new StoreError('请在发起登录的浏览器中完成授权', 403);
      if (
        typeof body.sessionId !== 'string' ||
        typeof body.input !== 'string' ||
        !body.input.trim()
      )
        throw new StoreError('请粘贴授权结果');
      // Check the kind without consuming the session, so a misrouted request
      // does not burn a still-valid login.
      if (store.readSession(body.sessionId, owner).kind === 'device')
        throw new StoreError('该登录使用设备码，请在页面上等待自动完成');
      const session = store.takeSession(body.sessionId, owner);
      const code = parseAuthorizationCode(session.authorization, body.input);
      const credential = await exchangeAuthorization(
        session.authorization,
        code,
        session.projectId,
        undefined,
        req.signal
      );
      if (req.signal.aborted)
        throw new SubscriptionError('cancelled', 499, '操作已取消');
      return await finishLogin(
        session.authorization.vendor,
        credential,
        session.reconnectId
      );
    }
    if (
      parts[0] === 'oauth' &&
      parts[1] === 'poll' &&
      parts.length === 2 &&
      req.method === 'POST'
    ) {
      const owner = ownerCookie(req);
      if (!owner) throw new StoreError('请在发起登录的浏览器中完成授权', 403);
      if (typeof body.sessionId !== 'string')
        throw new StoreError('登录会话无效');
      const lease = store.leasePoll(body.sessionId, owner);
      // Another poll is already in flight or the interval has not elapsed.
      if (!lease.authorization)
        return json({ status: 'pending', retryAfterMs: lease.retryAfterMs });
      if (lease.authorization.kind !== 'device')
        throw new StoreError('该登录不使用设备码');
      let result;
      try {
        result = await pollDeviceAuthorization(
          lease.authorization,
          undefined,
          req.signal
        );
      } catch (error) {
        // A refusal is terminal: drop the session so the UI starts a fresh login.
        if (
          error instanceof SubscriptionError &&
          ['device_expired', 'authorization_denied'].includes(error.code)
        )
          store.cancelSession(body.sessionId, owner);
        throw error;
      }
      if (result.status === 'pending') {
        store.deferPoll(body.sessionId, owner, result.retryAfterMs);
        return json({ status: 'pending', retryAfterMs: result.retryAfterMs });
      }
      if (req.signal.aborted)
        throw new SubscriptionError('cancelled', 499, '操作已取消');
      const session = store.takeSession(body.sessionId, owner);
      return await finishLogin(
        session.authorization.vendor,
        result.credential,
        session.reconnectId
      );
    }
    if (parts[0] === 'oauth' && parts.length === 2 && req.method === 'DELETE') {
      const owner = ownerCookie(req);
      if (owner) store.cancelSession(parts[1], owner);
      return json({ ok: true });
    }
    const id = parts[0];
    if (!id || !store.get(id)) throw new StoreError('账号不存在', 404);
    if (parts.length === 1 && req.method === 'PATCH') {
      if (typeof body.enabled !== 'boolean')
        throw new StoreError('enabled 必须为布尔值');
      return json({ account: store.setEnabled(id, body.enabled) });
    }
    if (parts.length === 1 && req.method === 'DELETE') {
      store.deleteAccount(id);
      return json({ ok: true });
    }
    if (parts.length === 2 && parts[1] === 'quota' && req.method === 'POST') {
      await lifecycle.quota(id);
      return json({ account: store.get(id) });
    }
    if (parts.length === 2 && parts[1] === 'models' && req.method === 'POST') {
      const result = await lifecycle.models(id);
      const account = store.get(id);
      if (!result)
        return json(
          { error: account?.modelsError ?? '模型列表拉取失败', account },
          502
        );
      const { account: _synced, ...summary } = result;
      return json({ account, result: summary });
    }
    if (parts.length === 3 && parts[1] === 'models' && req.method === 'PATCH')
      return json({ model: store.updateModel(id, parts[2], body) });
    if (parts.length === 3 && parts[1] === 'models' && req.method === 'DELETE') {
      store.deleteModel(id, parts[2]);
      return json({ ok: true });
    }
    if (parts.length === 2 && parts[1] === 'gateway' && req.method === 'POST')
      return json({
        account: store.connectGateway(id, body.models as string[]),
      });
    if (
      parts.length === 2 &&
      parts[1] === 'gateway' &&
      req.method === 'DELETE'
    ) {
      store.disconnectGateway(id);
      return json({ account: store.get(id) });
    }
    return json({ error: '接口不存在' }, 404);
  } catch (error) {
    if (error instanceof StoreError || error instanceof SubscriptionError)
      return json({ error: error.message }, error.status);
    return json({ error: '操作未完成，请稍后重试' }, 500);
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
