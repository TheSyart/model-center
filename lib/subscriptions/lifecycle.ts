import {
  StoreError,
  type createSubscriptionStore,
  type ModelSyncResult,
} from './store.ts';
import type {
  Credential,
  ModelDiscovery,
  QuotaSnapshot,
  SubscriptionVendor,
} from './types.ts';

export function createSubscriptionLifecycle(
  store: ReturnType<typeof createSubscriptionStore>,
  deps: {
    refresh(
      vendor: SubscriptionVendor,
      credential: Credential
    ): Promise<Credential>;
    quota(
      vendor: SubscriptionVendor,
      credential: Credential
    ): Promise<QuotaSnapshot>;
    models?(
      vendor: SubscriptionVendor,
      credential: Credential
    ): Promise<ModelDiscovery>;
    now?: () => number;
  }
) {
  const now = deps.now ?? Date.now;
  const inflight = new Map<string, Promise<Credential>>();
  const quotaInflight = new Map<string, Promise<void>>();
  const modelsInflight = new Map<string, Promise<ModelSyncResult | null>>();
  function assertReady(id: string) {
    const account = store.get(id);
    if (!account) throw new StoreError('订阅账号不存在', 404);
    if (!account.enabled) throw new StoreError('订阅账号已禁用', 503);
    if (account.authStatus === 'needs_reauth')
      throw new StoreError('订阅账号需要重新授权', 503);
    return account;
  }
  async function credential(
    id: string,
    rejectedAccessToken?: string
  ): Promise<Credential> {
    const account = assertReady(id);
    const current = store.getCredential(id);
    if (
      current.expiresAt > now() + 60000 &&
      (!rejectedAccessToken || current.accessToken !== rejectedAccessToken)
    )
      return current;
    if (inflight.has(id)) return inflight.get(id)!;
    const work = (async () => {
      const version = store.getVersion(id);
      const lease = store.acquireRefresh(id);
      if (!lease) {
        // Another worker owns a bounded lease; do not spend a rotating refresh token twice.
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 250));
          assertReady(id);
          const c = store.getCredential(id);
          if (store.getVersion(id) !== version && c.expiresAt > now() + 60000)
            return c;
        }
        throw new StoreError('凭据正在刷新或暂时不可用，请稍后重试', 503);
      }
      try {
        const leased = lease.credential;
        const next = await deps.refresh(account.vendor, leased);
        if (
          !next.accessToken ||
          !next.refreshToken ||
          /\s/.test(next.accessToken) ||
          /\s/.test(next.refreshToken) ||
          !Number.isFinite(next.expiresAt) ||
          next.expiresAt <= now() + 60000 ||
          next.accountKey !== leased.accountKey ||
          (next.organizationId ?? '') !== (leased.organizationId ?? '') ||
          (next.projectId ?? '') !== (leased.projectId ?? '')
        )
          throw new Error('invalid refresh');
        store.finishRefresh(id, lease, next);
        assertReady(id);
        // Re-login/deletion racing the refresh cannot resurrect stale credentials.
        const latest = store.getCredential(id);
        if (latest.expiresAt <= now() + 60000)
          throw new StoreError('凭据仍在刷新，请稍后重试', 503);
        return latest;
      } catch (error) {
        const needsReauth =
          !!error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'needs_reauth';
        store.failRefresh(id, lease, needsReauth);
        throw new StoreError(
          needsReauth ? '订阅账号需要重新授权' : '凭据刷新暂不可用，请稍后重试',
          503
        );
      }
    })();
    inflight.set(id, work);
    try {
      return await work;
    } finally {
      inflight.delete(id);
    }
  }
  async function quota(id: string): Promise<void> {
    if (quotaInflight.has(id)) return quotaInflight.get(id)!;
    const work = (async () => {
      let version: number | undefined;
      try {
        version = store.getVersion(id);
        const account = assertReady(id);
        await credential(id);
        let state = store.getCredentialState(id);
        version = state.version;
        let snapshot: QuotaSnapshot;
        try {
          snapshot = await deps.quota(account.vendor, state.credential);
        } catch (error) {
          if (
            !error ||
            typeof error !== 'object' ||
            !('status' in error) ||
            error.status !== 401
          )
            throw error;
          await credential(id, state.credential.accessToken);
          state = store.getCredentialState(id);
          version = state.version;
          snapshot = await deps.quota(account.vendor, state.credential);
        }
        store.saveQuota(id, snapshot, version);
      } catch (error) {
        if (version !== undefined)
          store.saveQuotaError(
            id,
            error instanceof StoreError
              ? error.message
              : '额度查询失败，请稍后重试或重新授权',
            version
          );
      }
    })();
    quotaInflight.set(id, work);
    try {
      await work;
    } finally {
      quotaInflight.delete(id);
    }
  }
  /** Fetches the vendor's model list and merges it into the gateway. Like quota, it
   * never throws: a failure is recorded on the account and null is returned. */
  async function models(id: string): Promise<ModelSyncResult | null> {
    if (modelsInflight.has(id)) return modelsInflight.get(id)!;
    const work = (async () => {
      let version: number | undefined;
      try {
        version = store.getVersion(id);
        if (!deps.models)
          throw new StoreError('当前运行环境未启用模型拉取', 503);
        const account = assertReady(id);
        await credential(id);
        let state = store.getCredentialState(id);
        version = state.version;
        let discovery: ModelDiscovery;
        try {
          discovery = await deps.models(account.vendor, state.credential);
        } catch (error) {
          if (
            !error ||
            typeof error !== 'object' ||
            !('status' in error) ||
            error.status !== 401
          )
            throw error;
          await credential(id, state.credential.accessToken);
          state = store.getCredentialState(id);
          version = state.version;
          discovery = await deps.models(account.vendor, state.credential);
        }
        return store.syncGatewayModels(id, discovery);
      } catch (error) {
        // Store and upstream errors carry fixed, credential-free messages.
        const known =
          error instanceof StoreError ||
          (error instanceof Error && 'code' in error && 'status' in error);
        if (version !== undefined)
          store.saveModelsError(
            id,
            known
              ? `模型列表拉取失败：${(error as Error).message}`
              : '模型列表拉取失败，请稍后重试或手动填写模型',
            version
          );
        return null;
      }
    })();
    modelsInflight.set(id, work);
    try {
      return await work;
    } finally {
      modelsInflight.delete(id);
    }
  }
  return { credential, quota, models };
}
