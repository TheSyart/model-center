import { asc, eq } from 'drizzle-orm';
import { db, schema, sqlite } from '@/lib/db';
import type { providers } from '@/lib/db/schema';
import { getSetting } from '@/lib/settings';
import { getEnabledDefaultEndpoint, listProviderEndpoints } from './provider-endpoint';
import { serializeProviderRecord } from './provider-serialization';
import { decrypt } from '@/lib/crypto';
import { createProviderAuthPolicy, ProviderAuthError } from './provider-auth';
export { ProviderAuthError } from './provider-auth';
import { validateProviderBaseUrl } from './provider-url';

export const providerAuthPolicy = createProviderAuthPolicy(sqlite);
export const getProviderSubscriptionId = providerAuthPolicy.accountId;
export function rejectSubscriptionProviderAction(id: string) {
  return getProviderSubscriptionId(id) ? Response.json({ error: new ProviderAuthError().message }, { status: 409, headers: { 'Cache-Control': 'no-store' } }) : null;
}
export function readProviderApiKey(provider: ProviderRow) { return providerAuthPolicy.readApiKey(provider, decrypt); }

export type ProviderRow = typeof providers.$inferSelect;

/** 序列化给前端的形态：绝不返回 api_key 明文/密文，只返回 has_key。 */
export function serializeProvider(p: ProviderRow, endpoints = listProviderEndpoints(sqlite, p.id)) {
  return serializeProviderRecord(p, endpoints, getProviderSubscriptionId(p.id));
}

export function listProviders() {
  return db.select().from(schema.providers).orderBy(asc(schema.providers.createdAt)).all();
}

export function getProvider(id: string): ProviderRow | undefined {
  return db.select().from(schema.providers).where(eq(schema.providers.id, id)).get();
}

/**
 * Returns the provider compatibility view projected from its enabled default
 * endpoint. Existing single-endpoint rows safely fall back to their legacy
 * protocol/base_url projection.
 */
export function withDefaultProviderEndpoint(provider: ProviderRow): ProviderRow {
  const endpoint = getEnabledDefaultEndpoint(sqlite, provider.id);
  return endpoint ? { ...provider, protocol: endpoint.protocol, baseUrl: endpoint.baseUrl } : provider;
}

/**
 * SSRF 防护（§10）：base_url 默认必须是 https。
 * 例外：loopback 地址（localhost/127.0.0.1/::1）始终允许 http（本地模型如 Ollama）；
 * 非 loopback 的 http 需设置 settings.allow_http_providers=1（设置页可开）。
 */
export function validateBaseUrl(baseUrl: string): string | null {
  return validateProviderBaseUrl(baseUrl, getSetting('allow_http_providers') === '1');
}

export const PROTOCOLS = ['openai', 'openai-responses', 'anthropic', 'gemini'] as const;
export type Protocol = (typeof PROTOCOLS)[number];
