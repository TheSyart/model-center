export type SubscriptionVendor = 'claude' | 'codex' | 'gemini' | 'antigravity' | 'copilot';

/** 授权交互形态：paste 让用户粘贴授权结果，device 由服务端轮询上游设备码。 */
export type AuthorizationKind = 'paste' | 'device';

export interface Credential {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountKey: string;
  email: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  plan?: string | null;
  /** Copilot only: the inference host GitHub assigned to this seat. */
  apiBase?: string | null;
}

export interface DeviceAuthorization {
  /** Codex 用 device_auth_id，Copilot 用 device_code；属于会话机密，不下发浏览器。 */
  handle: string;
  userCode: string;
  intervalMs: number;
  expiresAt: number;
}

export interface Authorization {
  vendor: SubscriptionVendor;
  kind: AuthorizationKind;
  /** paste：官方授权页；device：用户需要打开并输入用户码的验证页。 */
  url: string;
  state: string;
  verifier: string;
  redirectUri: string;
  device?: DeviceAuthorization;
}

/** Gateway protocol a listed model is served over. */
export type ModelEndpoint = 'openai' | 'openai-responses' | 'anthropic' | 'gemini';

export interface DiscoveredModel {
  id: string;
  displayName: string | null;
  /** Only Copilot splits models across endpoints; other vendors list their one protocol. */
  endpoints: ModelEndpoint[];
}

export interface ModelDiscovery {
  models: DiscoveredModel[];
  /** Entries dropped by filtering, validation or the size cap. */
  skipped: number;
  /** Human-readable description of the official listing endpoint. */
  source: string;
  checkedAt: number;
}

export interface QuotaWindow {
  id: string;
  label: string;
  modelId: string | null;
  usedPercent: number | null;
  remainingPercent: number | null;
  resetAt: number | null;
  windowSeconds: number | null;
}

export interface QuotaSnapshot {
  checkedAt: number;
  plan: string | null;
  windows: QuotaWindow[];
}

export interface AccountView {
  id: string;
  vendor: SubscriptionVendor;
  email: string | null;
  displayName: string;
  enabled: boolean;
  authStatus: 'ready' | 'needs_reauth';
  expiresAt: number;
  projectId: string | null;
  lastError: string | null;
  quota: QuotaSnapshot | null;
  quotaError: string | null;
  quotaAttemptedAt: number | null;
  providerId: string | null;
  providerSlug: string | null;
  /** Error from the last model-list fetch; the last successful merge stays in place. */
  modelsError: string | null;
  modelsSyncedAt: number | null;
  modelsAttemptedAt: number | null;
  /** Models registered on the linked gateway provider, 0 when not linked. */
  modelCount: number;
}
