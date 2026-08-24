import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { providers } from '@/lib/db/schema';
import { getSetting } from '@/lib/settings';

export type ProviderRow = typeof providers.$inferSelect;

/** 序列化给前端的形态：绝不返回 api_key 明文/密文，只返回 has_key。 */
export function serializeProvider(p: ProviderRow) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    protocol: p.protocol,
    base_url: p.baseUrl,
    enabled: p.enabled === 1,
    priority: p.priority,
    balance_config: p.balanceConfig,
    remark: p.remark,
    has_key: !!p.apiKeyEnc,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
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
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return 'base_url 不是合法 URL';
  }
  if (url.protocol === 'https:') return null;
  const host = url.hostname;
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (url.protocol === 'http:' && isLoopback) return null;
  if (url.protocol === 'http:' && getSetting('allow_http_providers') === '1') return null;
  return 'base_url 必须使用 https 协议（仅 localhost 允许 http，或在设置中开启 allow_http_providers）';
}

export const PROTOCOLS = ['openai', 'openai-responses', 'anthropic', 'gemini'] as const;
export type Protocol = (typeof PROTOCOLS)[number];
