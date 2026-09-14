import type Database from 'better-sqlite3';

export class ProviderAuthError extends Error {
  status = 409;
  constructor(
    message = '此服务商关联订阅账号，请在订阅账号页面管理授权、额度和网关关联'
  ) {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

/** Link-table ownership, never inferred from a slug, empty key, protocol or URL. */
export function createProviderAuthPolicy(sqlite: Database.Database) {
  const hasLinks = () =>
    !!sqlite
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='subscription_provider_links'"
      )
      .get();
  function accountId(providerId: string): string | null {
    if (!hasLinks()) return null;
    const row = sqlite
      .prepare(
        'SELECT account_id FROM subscription_provider_links WHERE provider_id=?'
      )
      .get(providerId) as { account_id: string } | undefined;
    return row?.account_id ?? null;
  }
  function requireApiKey(providerId: string) {
    if (accountId(providerId)) throw new ProviderAuthError();
  }
  return {
    accountId,
    requireApiKey,
    linkedProviderIds(): Set<string> {
      if (!hasLinks()) return new Set();
      return new Set(
        (
          sqlite
            .prepare('SELECT provider_id FROM subscription_provider_links')
            .all() as { provider_id: string }[]
        ).map((row) => row.provider_id)
      );
    },
    readApiKey(
      provider: { id: string; apiKeyEnc: string },
      decrypt: (value: string) => string
    ): string {
      requireApiKey(provider.id);
      return decrypt(provider.apiKeyEnc);
    },
    validatePatch(providerId: string, body: Record<string, unknown>) {
      if (!accountId(providerId)) return;
      if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new ProviderAuthError('订阅账号服务商修改请求无效');
      const permitted = new Set(['enabled', 'name', 'remark', 'priority']);
      if (Object.keys(body).some((key) => !permitted.has(key)))
        throw new ProviderAuthError(
          '订阅账号的协议、地址和凭据由授权管理，不能在服务商编辑器中修改'
        );
      if (body.enabled !== undefined && typeof body.enabled !== 'boolean')
        throw new ProviderAuthError('订阅账号 enabled 必须是布尔值');
      if (
        body.priority !== undefined &&
        (typeof body.priority !== 'number' || !Number.isFinite(body.priority))
      )
        throw new ProviderAuthError('订阅账号 priority 必须是有效数字');
      if (
        (body.name !== undefined && typeof body.name !== 'string') ||
        (body.remark !== undefined && typeof body.remark !== 'string')
      )
        throw new ProviderAuthError('订阅账号名称和备注必须是文本');
    },
    /** Caller updates providers in the same SQLite transaction. */
    syncEnabled(providerId: string, enabled: boolean, timestamp: number) {
      const id = accountId(providerId);
      if (!id) return;
      sqlite
        .prepare(
          'UPDATE subscription_accounts SET enabled=?,updated_at=? WHERE id=?'
        )
        .run(enabled ? 1 : 0, timestamp, id);
    },
  };
}
