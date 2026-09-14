import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  AccountView,
  Authorization,
  Credential,
  QuotaSnapshot,
  SubscriptionVendor,
} from './types.ts';

export function migrateSubscriptionSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_accounts (
      id TEXT PRIMARY KEY, vendor TEXT NOT NULL CHECK(vendor IN ('claude','codex','gemini')),
      account_key TEXT NOT NULL, email TEXT, display_name TEXT NOT NULL,
      credential_enc TEXT NOT NULL, expires_at INTEGER NOT NULL, project_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1, auth_status TEXT NOT NULL DEFAULT 'ready',
      last_error TEXT, version INTEGER NOT NULL DEFAULT 1,
      refresh_lease TEXT, refresh_until INTEGER, retry_after INTEGER,
      quota_json TEXT, quota_error TEXT, quota_attempted_at INTEGER,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(vendor,account_key)
    );
    CREATE TABLE IF NOT EXISTS subscription_oauth_sessions (
      id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, authorization_enc TEXT NOT NULL,
      project_id TEXT, reconnect_id TEXT, expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS subscription_provider_links (
      account_id TEXT UNIQUE NOT NULL REFERENCES subscription_accounts(id) ON DELETE RESTRICT,
      provider_id TEXT PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE
    );
  `);
}

type AccountRow = {
  id: string;
  vendor: SubscriptionVendor;
  account_key: string;
  email: string | null;
  display_name: string;
  credential_enc: string;
  expires_at: number;
  project_id: string | null;
  enabled: number;
  auth_status: 'ready' | 'needs_reauth';
  last_error: string | null;
  version: number;
  refresh_lease: string | null;
  refresh_until: number | null;
  retry_after: number | null;
  quota_json: string | null;
  quota_error: string | null;
  quota_attempted_at: number | null;
};
export interface RefreshLease {
  token: string;
  version: number;
  credential: Credential;
}
export class StoreError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const SUBSCRIPTION_ENDPOINTS = {
  claude: { protocol: 'anthropic', base: 'https://api.anthropic.com' },
  codex: {
    protocol: 'openai-responses',
    base: 'https://chatgpt.com/backend-api/codex',
  },
  gemini: { protocol: 'gemini', base: 'https://cloudcode-pa.googleapis.com' },
} as const;

export function createSubscriptionStore(
  db: Database.Database,
  deps: {
    encrypt(value: string): string;
    decrypt(value: string): string;
    now?: () => number;
  }
) {
  const now = deps.now ?? Date.now;
  const hash = (v: string) =>
    crypto.createHash('sha256').update(v).digest('hex');
  const row = (id: string) =>
    db.prepare('SELECT * FROM subscription_accounts WHERE id=?').get(id) as
      | AccountRow
      | undefined;
  const required = (id: string) => {
    const a = row(id);
    if (!a) throw new StoreError('订阅账号不存在', 404);
    return a;
  };
  function get(id: string): AccountView | null {
    const a = row(id);
    if (!a) return null;
    const link = db
      .prepare(
        'SELECT p.id,p.slug FROM subscription_provider_links l JOIN providers p ON p.id=l.provider_id WHERE account_id=?'
      )
      .get(id) as { id: string; slug: string } | undefined;
    return {
      id: a.id,
      vendor: a.vendor,
      email: a.email,
      displayName: a.display_name,
      enabled: a.enabled === 1,
      authStatus: a.auth_status,
      expiresAt: a.expires_at,
      projectId: a.project_id,
      lastError: a.last_error,
      quota: a.quota_json ? (JSON.parse(a.quota_json) as QuotaSnapshot) : null,
      quotaError: a.quota_error,
      quotaAttemptedAt: a.quota_attempted_at,
      providerId: link?.id ?? null,
      providerSlug: link?.slug ?? null,
    };
  }
  const scopedKey = (c: Credential) =>
    JSON.stringify([c.accountKey, c.organizationId ?? '', c.projectId ?? '']);
  function saveAccount(
    vendor: SubscriptionVendor,
    credential: Credential,
    reconnectId?: string
  ): AccountView {
    if (
      !credential.accountKey ||
      !credential.accessToken ||
      !credential.refreshToken ||
      !Number.isFinite(credential.expiresAt)
    )
      throw new StoreError('账号凭据不完整');
    const accountKey = scopedKey(credential);
    return db.transaction(() => {
      const existing = db
        .prepare(
          'SELECT id FROM subscription_accounts WHERE vendor=? AND account_key=?'
        )
        .get(vendor, accountKey) as { id: string } | undefined;
      if (reconnectId) {
        const original = required(reconnectId);
        if (original.vendor !== vendor || original.account_key !== accountKey)
          throw new StoreError('登录账号与所选账号不一致，请使用新增账号登录');
      }
      const id = existing?.id ?? crypto.randomUUID();
      const timestamp = now();
      db.prepare(
        `INSERT INTO subscription_accounts(id,vendor,account_key,email,display_name,credential_enc,expires_at,project_id,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(vendor,account_key) DO UPDATE SET
        email=excluded.email,credential_enc=excluded.credential_enc,expires_at=excluded.expires_at,project_id=excluded.project_id,
        auth_status='ready',last_error=NULL,version=subscription_accounts.version+1,refresh_lease=NULL,refresh_until=NULL,retry_after=NULL,updated_at=excluded.updated_at`
      ).run(
        id,
        vendor,
        accountKey,
        credential.email,
        credential.email ?? `${vendor} 账号`,
        deps.encrypt(JSON.stringify(credential)),
        credential.expiresAt,
        credential.projectId ?? null,
        timestamp,
        timestamp
      );
      return get(id)!;
    })();
  }
  function accountForProvider(providerId: string): AccountView | null {
    const link = db
      .prepare(
        'SELECT account_id FROM subscription_provider_links WHERE provider_id=?'
      )
      .get(providerId) as { account_id: string } | undefined;
    return link ? get(link.account_id) : null;
  }
  function connectGateway(id: string, modelIds: string[]): AccountView {
    if (
      !Array.isArray(modelIds) ||
      !modelIds.length ||
      modelIds.length > 100 ||
      modelIds.some(
        (m) =>
          typeof m !== 'string' ||
          !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(m) ||
          m.includes('..')
      )
    )
      throw new StoreError('请输入 1–100 个合法模型 ID');
    return db.transaction(() => {
      const a = required(id);
      const existing = get(id)!;
      const providerId = existing.providerId ?? crypto.randomUUID();
      if (!existing.providerId) {
        const endpoint = SUBSCRIPTION_ENDPOINTS[a.vendor];
        const timestamp = now();
        db.prepare(
          `INSERT INTO providers(id,slug,name,protocol,base_url,api_key_enc,enabled,priority,created_at,updated_at) VALUES(?,?,?,?,?,'',?,0,?,?)`
        ).run(
          providerId,
          `oauth-${a.vendor}-${id.slice(0, 8)}`,
          `${a.vendor} · ${a.display_name}`,
          endpoint.protocol,
          endpoint.base,
          a.enabled,
          timestamp,
          timestamp
        );
        db.prepare(
          `INSERT INTO provider_endpoints(id,provider_id,protocol,base_url,enabled,is_default,created_at,updated_at) VALUES(?,?,?,?,1,1,?,?)`
        ).run(
          crypto.randomUUID(),
          providerId,
          endpoint.protocol,
          endpoint.base,
          timestamp,
          timestamp
        );
        db.prepare(
          'INSERT INTO subscription_provider_links(account_id,provider_id) VALUES(?,?)'
        ).run(id, providerId);
      }
      for (const modelId of new Set(modelIds))
        db.prepare(
          'INSERT INTO models(id,provider_id,model_id,enabled,pricing_source) VALUES(?,?,?,1,?) ON CONFLICT(provider_id,model_id) DO NOTHING'
        ).run(crypto.randomUUID(), providerId, modelId, 'subscription');
      return get(id)!;
    })();
  }
  return {
    get,
    saveAccount,
    accountForProvider,
    connectGateway,
    list: () =>
      (
        db
          .prepare(
            'SELECT id FROM subscription_accounts ORDER BY created_at,id'
          )
          .all() as { id: string }[]
      ).map((a) => get(a.id)!),
    getCredential(id: string): Credential {
      return JSON.parse(
        deps.decrypt(required(id).credential_enc)
      ) as Credential;
    },
    getCredentialState(id: string) {
      const a = required(id);
      return {
        credential: JSON.parse(deps.decrypt(a.credential_enc)) as Credential,
        version: a.version,
      };
    },
    getVersion(id: string) {
      return required(id).version;
    },
    setEnabled(id: string, enabled: boolean) {
      required(id);
      db.transaction(() => {
        db.prepare(
          'UPDATE subscription_accounts SET enabled=?,updated_at=? WHERE id=?'
        ).run(enabled ? 1 : 0, now(), id);
        db.prepare(
          'UPDATE providers SET enabled=?,updated_at=? WHERE id IN (SELECT provider_id FROM subscription_provider_links WHERE account_id=?)'
        ).run(enabled ? 1 : 0, now(), id);
      })();
      return get(id)!;
    },
    deleteAccount(id: string) {
      required(id);
      if (get(id)!.providerId) throw new StoreError('请先解除网关关联', 409);
      db.prepare('DELETE FROM subscription_accounts WHERE id=?').run(id);
    },
    disconnectGateway(id: string) {
      return db.transaction(() => {
        const account = get(id);
        if (!account) throw new StoreError('账号不存在', 404);
        if (!account.providerId) return;
        for (const alias of db
          .prepare('SELECT targets FROM route_aliases')
          .all() as { targets: string }[]) {
          let targets: unknown;
          try {
            targets = JSON.parse(alias.targets);
          } catch {
            throw new StoreError('请先修复无效路由别名，再解除关联', 409);
          }
          if (
            Array.isArray(targets) &&
            targets.some((t) => t?.provider_id === account.providerId)
          )
            throw new StoreError('请先从路由别名中移除此账号', 409);
        }
        db.prepare('DELETE FROM providers WHERE id=?').run(account.providerId);
      })();
    },
    createSession(
      authorization: Authorization,
      owner: string,
      projectId?: string,
      reconnectId?: string
    ) {
      if (reconnectId && required(reconnectId).vendor !== authorization.vendor)
        throw new StoreError('重新登录的厂商不匹配');
      db.prepare(
        'DELETE FROM subscription_oauth_sessions WHERE expires_at<?'
      ).run(now());
      const id = crypto.randomUUID();
      const expiresAt = now() + 600000;
      db.prepare(
        'INSERT INTO subscription_oauth_sessions(id,owner_hash,authorization_enc,project_id,reconnect_id,expires_at) VALUES(?,?,?,?,?,?)'
      ).run(
        id,
        hash(owner),
        deps.encrypt(JSON.stringify(authorization)),
        projectId ?? null,
        reconnectId ?? null,
        expiresAt
      );
      return {
        id,
        url: authorization.url,
        vendor: authorization.vendor,
        expiresAt,
      };
    },
    takeSession(id: string, owner: string) {
      return db.transaction(() => {
        const s = db
          .prepare(
            "SELECT * FROM subscription_oauth_sessions WHERE id=? AND owner_hash=? AND status='pending' AND expires_at>?"
          )
          .get(id, hash(owner), now()) as
          | {
              authorization_enc: string;
              project_id: string | null;
              reconnect_id: string | null;
            }
          | undefined;
        if (!s)
          throw new StoreError('登录会话已过期、已使用或不属于当前浏览器', 409);
        db.prepare('DELETE FROM subscription_oauth_sessions WHERE id=?').run(
          id
        );
        return {
          authorization: JSON.parse(
            deps.decrypt(s.authorization_enc)
          ) as Authorization,
          projectId: s.project_id ?? undefined,
          reconnectId: s.reconnect_id ?? undefined,
        };
      })();
    },
    cancelSession(id: string, owner: string) {
      db.prepare(
        'DELETE FROM subscription_oauth_sessions WHERE id=? AND owner_hash=?'
      ).run(id, hash(owner));
    },
    acquireRefresh(id: string): RefreshLease | null {
      return db.transaction(() => {
        const a = required(id);
        if ((a.refresh_until ?? 0) > now() || (a.retry_after ?? 0) > now())
          return null;
        const token = crypto.randomUUID();
        const credential = JSON.parse(
          deps.decrypt(a.credential_enc)
        ) as Credential;
        db.prepare(
          'UPDATE subscription_accounts SET refresh_lease=?,refresh_until=? WHERE id=?'
        ).run(token, now() + 60000, id);
        return { token, version: a.version, credential };
      })();
    },
    finishRefresh(
      id: string,
      lease: RefreshLease,
      credential: Credential
    ): boolean {
      return (
        db
          .prepare(
            `UPDATE subscription_accounts SET credential_enc=?,expires_at=?,version=version+1,
        refresh_lease=NULL,refresh_until=NULL,retry_after=NULL,last_error=NULL,auth_status='ready',updated_at=?
        WHERE id=? AND refresh_lease=? AND version=?`
          )
          .run(
            deps.encrypt(JSON.stringify(credential)),
            credential.expiresAt,
            now(),
            id,
            lease.token,
            lease.version
          ).changes === 1
      );
    },
    failRefresh(id: string, lease: RefreshLease, needsReauth: boolean) {
      db.prepare(
        `UPDATE subscription_accounts SET refresh_lease=NULL,refresh_until=NULL,retry_after=?,
        auth_status=?,last_error=? WHERE id=? AND refresh_lease=? AND version=?`
      ).run(
        now() + 30000,
        needsReauth ? 'needs_reauth' : 'ready',
        needsReauth ? '登录已失效，请重新授权' : '凭据刷新暂不可用，请稍后重试',
        id,
        lease.token,
        lease.version
      );
    },
    saveQuota(id: string, snapshot: QuotaSnapshot, expectedVersion?: number) {
      const version = expectedVersion ?? required(id).version;
      return (
        db
          .prepare(
            'UPDATE subscription_accounts SET quota_json=?,quota_error=NULL,quota_attempted_at=? WHERE id=? AND version=?'
          )
          .run(JSON.stringify(snapshot), now(), id, version).changes === 1
      );
    },
    saveQuotaError(id: string, error: string, expectedVersion?: number) {
      const version = expectedVersion ?? row(id)?.version;
      if (version === undefined) return false;
      return (
        db
          .prepare(
            'UPDATE subscription_accounts SET quota_error=?,quota_attempted_at=? WHERE id=? AND version=?'
          )
          .run(error.slice(0, 300), now(), id, version).changes === 1
      );
    },
  };
}
