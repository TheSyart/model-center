export type SubscriptionVendor = 'claude' | 'codex' | 'gemini';

export interface Credential {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountKey: string;
  email: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  plan?: string | null;
}

export interface Authorization {
  vendor: SubscriptionVendor;
  url: string;
  state: string;
  verifier: string;
  redirectUri: string;
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
}
