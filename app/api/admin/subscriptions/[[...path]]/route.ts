import crypto from 'node:crypto';
import {
  subscriptionStore as store,
  subscriptionLifecycle as lifecycle,
} from '@/lib/subscriptions/runtime';
import {
  createAuthorization,
  parseAuthorizationCode,
  exchangeAuthorization,
  SubscriptionError,
} from '@/lib/subscriptions/oauth';
import { StoreError } from '@/lib/subscriptions/store';
import {
  assertSubscriptionMutation,
  subscriptionPublicOrigin,
  readSubscriptionBody,
  subscriptionResponse as json,
} from '@/lib/subscriptions/http';
import type { SubscriptionVendor } from '@/lib/subscriptions/types';

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

async function handle(
  req: Request,
  context: { params: Promise<{ path?: string[] }> }
) {
  try {
    const parts = (await context.params).path ?? [];
    if (req.method === 'GET' && !parts.length)
      return json({ accounts: store.list() });
    assertSubscriptionMutation(req);
    const body = req.method === 'DELETE' ? {} : await readSubscriptionBody(req);
    if (parts[0] === 'oauth' && parts.length === 1 && req.method === 'POST') {
      if (!['claude', 'codex', 'gemini'].includes(String(body.vendor)))
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
      const session = store.createSession(
        createAuthorization(body.vendor as SubscriptionVendor),
        owner,
        body.projectId as string | undefined,
        body.reconnectId as string | undefined
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
      const account = store.saveAccount(
        session.authorization.vendor,
        credential,
        session.reconnectId
      );
      // Login and quota availability are independent: a quota failure must not undo login.
      await lifecycle.quota(account.id);
      return json({ account: store.get(account.id) });
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
