import { asc, eq } from 'drizzle-orm';
import { db, schema, sqlite } from '@/lib/db';
import type { providers } from '@/lib/db/schema';
import { getSetting } from '@/lib/settings';
import { listProviderEndpoints } from './provider-endpoint';
import { serializeProviderRecord } from './provider-serialization';
import { validateProviderBaseUrl } from './provider-url';

export type ProviderRow = typeof providers.$inferSelect;

/** 序列化给前端的形态：绝不返回 api_key 明文/密文，只返回 has_key。 */
export function serializeProvider(p: ProviderRow, endpoints = listProviderEndpoints(sqlite, p.id)) {
  return serializeProviderRecord(p, endpoints);
}

export function listProviders() {
  return db.select().from(schema.providers).orderBy(asc(schema.providers.createdAt)).all();
}

export function getProvider(id: string): ProviderRow | undefined {
  return db.select().from(schema.providers).where(eq(schema.providers.id, id)).get();
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
