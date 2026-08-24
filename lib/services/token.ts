import crypto from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { decrypt, encrypt } from '@/lib/crypto';
import { db, schema } from '@/lib/db';
import type { gatewayTokens } from '@/lib/db/schema';

export type TokenRow = typeof gatewayTokens.$inferSelect;

export type SpendWindow = 'day' | 'week' | 'month' | 'total';

export const SPEND_WINDOWS: SpendWindow[] = ['day', 'week', 'month', 'total'];

export const SPEND_WINDOW_LABELS: Record<SpendWindow, string> = {
  day: '当天',
  week: '近 7 天',
  month: '近 30 天',
  total: '累计',
};

export function generateTokenKey(): string {
  return 'mc-' + crypto.randomBytes(24).toString('hex');
}

export function hashTokenKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

export function serializeToken(t: TokenRow, spent?: number) {
  return {
    id: t.id,
    name: t.name,
    prefix: t.prefix,
    enabled: t.enabled === 1,
    expires_at: t.expiresAt,
    spend_limit: t.spendLimit,
    spend_window: t.spendWindow,
    spent: spent ?? null,
    created_at: t.createdAt,
  };
}

export function listTokens(): TokenRow[] {
  return db.select().from(schema.gatewayTokens).orderBy(asc(schema.gatewayTokens.createdAt)).all();
}

export function getToken(id: string): TokenRow | undefined {
  return db.select().from(schema.gatewayTokens).where(eq(schema.gatewayTokens.id, id)).get();
}

export function createToken(input: {
  name: string;
  expires_at?: number | null;
  spend_limit?: number | null;
  spend_window?: SpendWindow | null;
}): { row: TokenRow; plaintext: string } {
  const plaintext = generateTokenKey();
  const row: TokenRow = {
    id: crypto.randomUUID(),
    name: input.name,
    keyEnc: encrypt(plaintext),
    keyHash: hashTokenKey(plaintext),
    prefix: plaintext.slice(0, 10),
    enabled: 1,
    expiresAt: input.expires_at ?? null,
    spendLimit: input.spend_limit ?? null,
    spendWindow: input.spend_limit != null ? (input.spend_window ?? 'total') : null,
    createdAt: Date.now(),
  };
  db.insert(schema.gatewayTokens).values(row).run();
  return { row, plaintext };
}

export function updateToken(
  id: string,
  input: { name?: string; enabled?: boolean; expires_at?: number | null; spend_limit?: number | null; spend_window?: SpendWindow | null },
): TokenRow | null {
  const existing = getToken(id);
  if (!existing) return null;
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.enabled !== undefined) updates.enabled = input.enabled ? 1 : 0;
  if (input.expires_at !== undefined) updates.expiresAt = input.expires_at;
  if (input.spend_limit !== undefined) {
    updates.spendLimit = input.spend_limit;
    updates.spendWindow = input.spend_limit != null ? (input.spend_window ?? existing.spendWindow ?? 'total') : null;
  } else if (input.spend_window !== undefined && existing.spendLimit != null) {
    updates.spendWindow = input.spend_window;
  }
  db.update(schema.gatewayTokens).set(updates).where(eq(schema.gatewayTokens.id, id)).run();
  return getToken(id)!;
}

export function deleteToken(id: string): boolean {
  if (!getToken(id)) return false;
  db.delete(schema.gatewayTokens).where(eq(schema.gatewayTokens.id, id)).run();
  return true;
}

/** 查看令牌明文（同 provider key 模式：加密存储、按需解密）。 */
export function getTokenPlaintext(t: TokenRow): string {
  return decrypt(t.keyEnc);
}

/** 窗口起点（ms 时间戳）：day=本地当天 0 点、week=近 7 天、month=近 30 天、total=0（全部）。 */
export function windowStart(window: SpendWindow | null): number {
  if (window === 'day') {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  if (window === 'week') return Date.now() - 7 * 86_400_000;
  if (window === 'month') return Date.now() - 30 * 86_400_000;
  return 0;
}

/**
 * 窗口内该令牌已消耗金额（按 request_logs.cost 聚合）。
 * 注意：未配置单价的调用 cost 为 null，不计入限额（见文档 §7.2 说明）。
 */
export function spentInWindow(tokenId: string, window: SpendWindow | null): number {
  const since = windowStart(window);
  const row = db.get<{ spent: number | null }>(
    sql`SELECT COALESCE(SUM(cost), 0) AS spent FROM request_logs WHERE token_id = ${tokenId} AND ts >= ${since}`,
  );
  return row?.spent ?? 0;
}

export interface LimitCheck {
  exceeded: boolean;
  spent: number;
  limit: number | null;
  window: SpendWindow | null;
}

/** 限额检查：无限额则直接通过。 */
export function checkSpendLimit(token: TokenRow): LimitCheck {
  if (token.spendLimit == null) {
    return { exceeded: false, spent: 0, limit: null, window: null };
  }
  const window = (token.spendWindow as SpendWindow | null) ?? 'total';
  const spent = spentInWindow(token.id, window);
  return { exceeded: spent >= token.spendLimit, spent, limit: token.spendLimit, window };
}

/** 网关鉴权：Bearer / x-api-key 令牌 → sha256 比对（表极小，全量逐个 timingSafeEqual）。 */
export type TokenAuthResult =
  | { ok: true; token: TokenRow }
  | { ok: false; code: 'invalid_api_key' | 'token_disabled' | 'token_expired'; message: string };

export function authenticateToken(plaintext: string): TokenAuthResult {
  const hash = Buffer.from(hashTokenKey(plaintext), 'hex');
  for (const token of listTokens()) {
    const expected = Buffer.from(token.keyHash, 'hex');
    if (hash.length === expected.length && crypto.timingSafeEqual(hash, expected)) {
      if (token.enabled !== 1) {
        return { ok: false, code: 'token_disabled', message: '令牌已禁用' };
      }
      if (token.expiresAt != null && token.expiresAt < Date.now()) {
        return { ok: false, code: 'token_expired', message: '令牌已过期' };
      }
      return { ok: true, token };
    }
  }
  return { ok: false, code: 'invalid_api_key', message: '无效或缺失的网关令牌' };
}
