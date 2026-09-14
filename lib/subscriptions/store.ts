import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { replaceEndpointModelCatalogInTransaction } from '../services/provider-endpoint.ts';
import { parseModelReasoning } from '../gateway/reasoning.ts';
import type {
  AccountView,
  Authorization,
  Credential,
  ModelDiscovery,
  QuotaSnapshot,
  SubscriptionModelView,
  SubscriptionVendor,
} from './types.ts';

const SUBSCRIPTION_ACCOUNTS_SCHEMA = `CREATE TABLE IF NOT EXISTS subscription_accounts (
      id TEXT PRIMARY KEY, vendor TEXT NOT NULL CHECK(vendor IN ('claude','codex','gemini','antigravity','copilot')),
      account_key TEXT NOT NULL, email TEXT, display_name TEXT NOT NULL,
      credential_enc TEXT NOT NULL, expires_at INTEGER NOT NULL, project_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1, auth_status TEXT NOT NULL DEFAULT 'ready',
      last_error TEXT, version INTEGER NOT NULL DEFAULT 1,
      refresh_lease TEXT, refresh_until INTEGER, retry_after INTEGER,
      quota_json TEXT, quota_error TEXT, quota_attempted_at INTEGER,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(vendor,account_key)
    );`;

export function migrateSubscriptionSchema(db: Database.Database) {
  const existing = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='subscription_accounts'"
    )
    .get() as { sql: string } | undefined;
  if (existing && !existing.sql.includes("'copilot'")) {
    if (db.inTransaction)
      throw new Error(
        'Subscription schema migration requires its own transaction'
      );
    const foreignKeys = db.pragma('foreign_keys', { simple: true });
    db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        db.exec(
          SUBSCRIPTION_ACCOUNTS_SCHEMA.replace(
            'IF NOT EXISTS subscription_accounts',
            'subscription_accounts_next'
          )
        );
        db.exec(`INSERT INTO subscription_accounts_next SELECT * FROM subscription_accounts;
          DROP TABLE subscription_accounts;
          ALTER TABLE subscription_accounts_next RENAME TO subscription_accounts;`);
        if ((db.pragma('foreign_key_check') as unknown[]).length)
          throw new Error('Subscription migration violates foreign keys');
      })();
    } finally {
      db.pragma(`foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`);
    }
  }
  db.exec(`
    ${SUBSCRIPTION_ACCOUNTS_SCHEMA}
    CREATE TABLE IF NOT EXISTS subscription_oauth_sessions (
      id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, authorization_enc TEXT NOT NULL,
      project_id TEXT, reconnect_id TEXT, expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      next_poll_at INTEGER, poll_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS subscription_provider_links (
      account_id TEXT UNIQUE NOT NULL REFERENCES subscription_accounts(id) ON DELETE RESTRICT,
      provider_id TEXT PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE
    );
  `);
  // The sessions table is ephemeral, so widening it needs no rebuild.
  const sessionColumns = new Set(
    (
      db.pragma('table_info(subscription_oauth_sessions)') as { name: string }[]
    ).map((column) => column.name)
  );
  for (const [column, ddl] of [
    ['next_poll_at', 'INTEGER'],
    ['poll_count', 'INTEGER NOT NULL DEFAULT 0'],
  ] as const)
    if (!sessionColumns.has(column))
      db.exec(
        `ALTER TABLE subscription_oauth_sessions ADD COLUMN ${column} ${ddl}`
      );
  // Model-sync bookkeeping is also widened in place. It stays out of
  // SUBSCRIPTION_ACCOUNTS_SCHEMA because the vendor rebuild above copies rows with
  // SELECT *, which needs the old and new column lists to match. A future rebuild
  // must add these columns to its target table first.
  const accountColumns = new Set(
    (
      db.pragma('table_info(subscription_accounts)') as { name: string }[]
    ).map((column) => column.name)
  );
  for (const [column, ddl] of [
    ['models_error', 'TEXT'],
    ['models_synced_at', 'INTEGER'],
    ['models_attempted_at', 'INTEGER'],
  ] as const)
    if (!accountColumns.has(column))
      db.exec(`ALTER TABLE subscription_accounts ADD COLUMN ${column} ${ddl}`);
}

export const isValidModelId = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(id) &&
  !id.includes('..');

/** A default endpoint with a complete catalog rejects models it does not list, so a
 * model added by hand to a subscription provider has to join that catalog to stay
 * routable. API-key providers keep their existing behaviour. */
export function addManualModelsToCompleteCatalog(
  db: Database.Database,
  providerId: string,
  modelIds: Iterable<string>,
  observedAt: number
) {
  const insert = db.prepare(
    `INSERT INTO provider_endpoint_models(endpoint_id,model_id,source,observed_at)
    SELECT e.id,?,'manual',? FROM provider_endpoints e
    WHERE e.provider_id=? AND e.is_default=1 AND e.model_catalog_complete=1
      AND EXISTS(SELECT 1 FROM subscription_provider_links l WHERE l.provider_id=e.provider_id)
    ON CONFLICT(endpoint_id,model_id) DO NOTHING`
  );
  for (const modelId of modelIds) insert.run(modelId, observedAt, providerId);
}

export interface ModelSyncResult {
  account: AccountView;
  added: number;
  existing: number;
  /** Previously synced models the vendor no longer lists; they are kept, not deleted. */
  missing: number;
  /** Legacy level-variant rows folded into their base model (still callable by name). */
  folded: number;
  skipped: number;
  total: number;
  source: string;
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
  models_error: string | null;
  models_synced_at: number | null;
  models_attempted_at: number | null;
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
  antigravity: {
    protocol: 'gemini',
    base: 'https://daily-cloudcode-pa.googleapis.com',
  },
  gemini: { protocol: 'gemini', base: 'https://cloudcode-pa.googleapis.com' },
  copilot: { protocol: 'openai', base: 'https://api.githubcopilot.com' },
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
      modelsError: a.models_error,
      modelsSyncedAt: a.models_synced_at,
      modelsAttemptedAt: a.models_attempted_at,
      modelCount: link
        ? (
            db
              .prepare('SELECT COUNT(*) n FROM models WHERE provider_id=?')
              .get(link.id) as { n: number }
          ).n
        : 0,
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
  /** Caller owns the transaction. The first endpoint created becomes the default. */
  function ensureEndpoint(
    providerId: string,
    protocol: string,
    base: string,
    timestamp: number
  ): string {
    const found = db
      .prepare(
        'SELECT id FROM provider_endpoints WHERE provider_id=? AND protocol=?'
      )
      .get(providerId, protocol) as { id: string } | undefined;
    if (found) return found.id;
    const hasDefault = db
      .prepare(
        'SELECT 1 FROM provider_endpoints WHERE provider_id=? AND is_default=1'
      )
      .get(providerId);
    const endpointId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO provider_endpoints(id,provider_id,protocol,base_url,enabled,is_default,created_at,updated_at) VALUES(?,?,?,?,1,?,?,?)`
    ).run(
      endpointId,
      providerId,
      protocol,
      base,
      hasDefault ? 0 : 1,
      timestamp,
      timestamp
    );
    return endpointId;
  }
  /** Caller owns the transaction. Creates the linked provider on first use. */
  function ensureProvider(a: AccountRow, timestamp: number): string {
    const linked = db
      .prepare(
        'SELECT provider_id FROM subscription_provider_links WHERE account_id=?'
      )
      .get(a.id) as { provider_id: string } | undefined;
    if (linked) return linked.provider_id;
    const endpoint = SUBSCRIPTION_ENDPOINTS[a.vendor];
    const providerId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO providers(id,slug,name,protocol,base_url,api_key_enc,enabled,priority,created_at,updated_at) VALUES(?,?,?,?,?,'',?,0,?,?)`
    ).run(
      providerId,
      `oauth-${a.vendor}-${a.id.slice(0, 8)}`,
      `${a.vendor} · ${a.display_name}`,
      endpoint.protocol,
      endpoint.base,
      a.enabled,
      timestamp,
      timestamp
    );
    ensureEndpoint(providerId, endpoint.protocol, endpoint.base, timestamp);
    db.prepare(
      'INSERT INTO subscription_provider_links(account_id,provider_id) VALUES(?,?)'
    ).run(a.id, providerId);
    return providerId;
  }
  /** Manual fallback for when the vendor model list cannot be fetched. */
  function connectGateway(id: string, modelIds: string[]): AccountView {
    if (
      !Array.isArray(modelIds) ||
      !modelIds.length ||
      modelIds.length > 100 ||
      !modelIds.every(isValidModelId)
    )
      throw new StoreError('请输入 1–100 个合法模型 ID');
    return db.transaction(() => {
      const timestamp = now();
      const providerId = ensureProvider(required(id), timestamp);
      for (const modelId of new Set(modelIds))
        db.prepare(
          'INSERT INTO models(id,provider_id,model_id,enabled,pricing_source) VALUES(?,?,?,1,?) ON CONFLICT(provider_id,model_id) DO NOTHING'
        ).run(crypto.randomUUID(), providerId, modelId, 'subscription');
      addManualModelsToCompleteCatalog(
        db,
        providerId,
        new Set(modelIds),
        timestamp
      );
      return get(id)!;
    })();
  }
  /** Merges a fetched vendor catalog into the gateway, creating the link if needed.
   * Additive only: models are never deleted and existing enabled flags never change. */
  function syncGatewayModels(
    id: string,
    discovery: ModelDiscovery
  ): ModelSyncResult {
    const models = discovery.models;
    if (
      !Array.isArray(models) ||
      !models.length ||
      models.length > 500 ||
      !models.every((m) => isValidModelId(m?.id))
    )
      throw new StoreError('上游模型列表无效');
    return db.transaction(() => {
      const a = required(id);
      const timestamp = now();
      const providerId = ensureProvider(a, timestamp);
      const existing = db
        .prepare(
          'SELECT model_id,alias,enabled,synced FROM models WHERE provider_id=?'
        )
        .all(providerId) as {
        model_id: string;
        alias: string | null;
        enabled: number;
        synced: number;
      }[];
      const rows = new Map(existing.map((m) => [m.model_id, m]));
      const upstream = new Set(models.map((m) => m.id));
      const insert = db.prepare(
        "INSERT INTO models(id,provider_id,model_id,display_name,enabled,synced,pricing_source,reasoning_json) VALUES(?,?,?,?,?,1,'subscription',?) ON CONFLICT(provider_id,model_id) DO NOTHING"
      );
      // Metadata refresh only: enabled flags and aliases stay as the operator set them.
      const refresh = db.prepare(
        'UPDATE models SET reasoning_json=?,display_name=CASE WHEN synced=1 THEN COALESCE(?,display_name) ELSE display_name END WHERE provider_id=? AND model_id=?'
      );
      let added = 0;
      let folded = 0;
      for (const model of models) {
        const reasoningJson = model.reasoning
          ? JSON.stringify(model.reasoning)
          : null;
        // Synced rows for names now folded into this base; manual rows are left alone.
        const legacy = (model.reasoning?.legacyIds ?? [])
          .map((legacyId) => rows.get(legacyId))
          .filter(
            (row): row is NonNullable<typeof row> =>
              !!row && row.synced === 1 && !upstream.has(row.model_id)
          );
        if (!rows.has(model.id)) {
          const enabled =
            legacy.length && legacy.every((row) => row.enabled !== 1) ? 0 : 1;
          insert.run(
            crypto.randomUUID(),
            providerId,
            model.id,
            model.displayName ?? null,
            enabled,
            reasoningJson
          );
          added++;
        } else
          refresh.run(
            reasoningJson,
            model.displayName ?? null,
            providerId,
            model.id
          );
        for (const row of legacy) {
          db.prepare('DELETE FROM models WHERE provider_id=? AND model_id=?').run(
            providerId,
            row.model_id
          );
          if (row.alias)
            db.prepare(
              'UPDATE models SET alias=? WHERE provider_id=? AND model_id=? AND alias IS NULL'
            ).run(row.alias, providerId, model.id);
          rows.delete(row.model_id);
          folded++;
        }
      }
      const known = new Set(
        (
          db
            .prepare('SELECT model_id FROM models WHERE provider_id=?')
            .all(providerId) as { model_id: string }[]
        ).map((row) => row.model_id)
      );
      if (a.vendor === 'copilot') {
        // Copilot serves some models only over /responses. One endpoint per protocol,
        // each with a complete catalog, lets the endpoint selector route every entry
        // protocol to an upstream path the model supports.
        const base = SUBSCRIPTION_ENDPOINTS.copilot.base;
        const chat = ensureEndpoint(providerId, 'openai', base, timestamp);
        const responses = ensureEndpoint(
          providerId,
          'openai-responses',
          base,
          timestamp
        );
        const listed = new Map(models.map((m) => [m.id, m]));
        // Manual and no-longer-listed models stay routable through chat completions.
        replaceEndpointModelCatalogInTransaction(
          db,
          chat,
          [...known].filter(
            (modelId) => listed.get(modelId)?.endpoints.includes('openai') ?? true
          ),
          timestamp
        );
        replaceEndpointModelCatalogInTransaction(
          db,
          responses,
          models
            .filter((m) => m.endpoints.includes('openai-responses'))
            .map((m) => m.id),
          timestamp
        );
      }
      db.prepare(
        'UPDATE subscription_accounts SET models_error=NULL,models_synced_at=?,models_attempted_at=? WHERE id=?'
      ).run(timestamp, timestamp, id);
      return {
        account: get(id)!,
        added,
        existing: models.length - added,
        missing: [...rows.values()].filter(
          (m) => m.synced === 1 && !upstream.has(m.model_id)
        ).length,
        folded,
        skipped: discovery.skipped,
        total: models.length,
        source: discovery.source,
      };
    })();
  }
  const MODEL_COLUMNS = 'id,model_id,display_name,alias,enabled,synced,reasoning_json';
  type ModelRow = {
    id: string;
    model_id: string;
    display_name: string | null;
    alias: string | null;
    enabled: number;
    synced: number;
    reasoning_json: string | null;
  };
  const modelView = (row: ModelRow): SubscriptionModelView => ({
    id: row.id,
    modelId: row.model_id,
    displayName: row.display_name,
    alias: row.alias,
    enabled: row.enabled === 1,
    synced: row.synced === 1,
    reasoning: parseModelReasoning(row.reasoning_json),
  });
  /** Ownership check: the model must belong to this account's linked provider. */
  function ownedModel(id: string, modelRowId: string) {
    required(id);
    const providerId = get(id)!.providerId;
    const row = providerId
      ? (db
          .prepare(`SELECT ${MODEL_COLUMNS} FROM models WHERE id=? AND provider_id=?`)
          .get(modelRowId, providerId) as ModelRow | undefined)
      : undefined;
    if (!providerId || !row) throw new StoreError('模型不存在', 404);
    return { providerId, row };
  }
  function listModels(id: string): SubscriptionModelView[] {
    required(id);
    const providerId = get(id)!.providerId;
    if (!providerId) return [];
    return (
      db
        .prepare(`SELECT ${MODEL_COLUMNS} FROM models WHERE provider_id=? ORDER BY model_id`)
        .all(providerId) as ModelRow[]
    ).map(modelView);
  }
  function updateModel(
    id: string,
    modelRowId: string,
    patch: Record<string, unknown>
  ): SubscriptionModelView {
    const allowed = new Set(['enabled', 'alias', 'displayName']);
    const keys = Object.keys(patch ?? {});
    if (!keys.length || keys.some((key) => !allowed.has(key)))
      throw new StoreError('只能修改模型的启用状态、别名和显示名');
    return db.transaction(() => {
      const { row } = ownedModel(id, modelRowId);
      const sets: string[] = [];
      const values: unknown[] = [];
      if (patch.enabled !== undefined) {
        if (typeof patch.enabled !== 'boolean')
          throw new StoreError('enabled 必须为布尔值');
        sets.push('enabled=?');
        values.push(patch.enabled ? 1 : 0);
      }
      if (patch.alias !== undefined) {
        const alias =
          patch.alias === null
            ? ''
            : typeof patch.alias === 'string'
              ? patch.alias.trim()
              : undefined;
        if (
          alias === undefined ||
          (alias && (alias.length > 200 || !/^[\w][\w./-]*$/.test(alias)))
        )
          throw new StoreError('别名格式不正确');
        if (
          alias &&
          (db.prepare('SELECT 1 FROM models WHERE alias=? AND id<>?').get(alias, row.id) ||
            db.prepare('SELECT 1 FROM route_aliases WHERE alias=?').get(alias))
        )
          throw new StoreError(`别名 "${alias}" 已被占用`, 409);
        sets.push('alias=?');
        values.push(alias || null);
      }
      if (patch.displayName !== undefined) {
        const name =
          patch.displayName === null
            ? ''
            : typeof patch.displayName === 'string'
              ? patch.displayName.trim()
              : undefined;
        if (name === undefined || name.length > 200 || /[\x00-\x1f\x7f]/.test(name))
          throw new StoreError('显示名格式不正确');
        sets.push('display_name=?');
        values.push(name || null);
      }
      db.prepare(`UPDATE models SET ${sets.join(',')} WHERE id=?`).run(...values, row.id);
      return modelView(
        db.prepare(`SELECT ${MODEL_COLUMNS} FROM models WHERE id=?`).get(row.id) as ModelRow
      );
    })();
  }
  function deleteModel(id: string, modelRowId: string) {
    db.transaction(() => {
      const { providerId, row } = ownedModel(id, modelRowId);
      db.prepare('DELETE FROM models WHERE id=?').run(row.id);
      db.prepare(
        'DELETE FROM provider_endpoint_models WHERE model_id=? AND endpoint_id IN (SELECT id FROM provider_endpoints WHERE provider_id=?)'
      ).run(row.model_id, providerId);
    })();
  }
  return {
    get,
    saveAccount,
    accountForProvider,
    connectGateway,
    syncGatewayModels,
    listModels,
    updateModel,
    deleteModel,
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
      reconnectId?: string,
      ttlMs?: number
    ) {
      if (reconnectId && required(reconnectId).vendor !== authorization.vendor)
        throw new StoreError('重新登录的厂商不匹配');
      db.prepare(
        'DELETE FROM subscription_oauth_sessions WHERE expires_at<?'
      ).run(now());
      const id = crypto.randomUUID();
      const ttl =
        typeof ttlMs === 'number' && Number.isFinite(ttlMs)
          ? Math.min(1_800_000, Math.max(60_000, Math.trunc(ttlMs)))
          : 600000;
      const expiresAt = now() + ttl;
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
        kind: authorization.kind,
        expiresAt,
        // device.handle stays server-side: holding it is enough to complete the login.
        ...(authorization.device
          ? {
              userCode: authorization.device.userCode,
              intervalMs: authorization.device.intervalMs,
            }
          : {}),
      };
    },
    /** Non-destructive read: lets a caller inspect a session without consuming it. */
    readSession(id: string, owner: string) {
      const row = db
        .prepare(
          "SELECT authorization_enc FROM subscription_oauth_sessions WHERE id=? AND owner_hash=? AND status='pending' AND expires_at>?"
        )
        .get(id, hash(owner), now()) as
        | { authorization_enc: string }
        | undefined;
      if (!row)
        throw new StoreError('登录会话已过期、已使用或不属于当前浏览器', 409);
      return JSON.parse(deps.decrypt(row.authorization_enc)) as Authorization;
    },
    /** Paces device polling. Doubles as the concurrency guard: two overlapping polls
     * must not both reach upstream, or the single-use device code gets spent twice. */
    leasePoll(id: string, owner: string) {
      return db.transaction(() => {
        const row = db
          .prepare(
            "SELECT authorization_enc, next_poll_at, poll_count FROM subscription_oauth_sessions WHERE id=? AND owner_hash=? AND status='pending' AND expires_at>?"
          )
          .get(id, hash(owner), now()) as
          | {
              authorization_enc: string;
              next_poll_at: number | null;
              poll_count: number;
            }
          | undefined;
        if (!row)
          throw new StoreError('登录会话已过期、已使用或不属于当前浏览器', 409);
        const at = now();
        if (row.next_poll_at !== null && row.next_poll_at > at)
          return { retryAfterMs: row.next_poll_at - at, authorization: null };
        if (row.poll_count >= 600)
          throw new StoreError('登录轮询次数过多，请重新发起登录', 429);
        const authorization = JSON.parse(
          deps.decrypt(row.authorization_enc)
        ) as Authorization;
        db.prepare(
          'UPDATE subscription_oauth_sessions SET next_poll_at=?, poll_count=poll_count+1 WHERE id=?'
        ).run(at + (authorization.device?.intervalMs ?? 5000), id);
        return { retryAfterMs: 0, authorization };
      })();
    },
    /** Backs the poll off further, for an upstream that asked us to slow down. */
    deferPoll(id: string, owner: string, delayMs: number) {
      db.prepare(
        'UPDATE subscription_oauth_sessions SET next_poll_at=? WHERE id=? AND owner_hash=?'
      ).run(now() + Math.min(60_000, Math.max(0, delayMs)), id, hash(owner));
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
    saveModelsError(id: string, error: string, expectedVersion?: number) {
      const version = expectedVersion ?? row(id)?.version;
      if (version === undefined) return false;
      return (
        db
          .prepare(
            'UPDATE subscription_accounts SET models_error=?,models_attempted_at=? WHERE id=? AND version=?'
          )
          .run(error.slice(0, 300), now(), id, version).changes === 1
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
