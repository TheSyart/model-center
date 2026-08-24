import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';
import { getLogRetentionDays } from './log';
import { aliasTaken } from './model';
import { setSetting } from '@/lib/settings';

const MASKED_KEY = '***';

/** 导出配置（F13）。api_key 默认脱敏为 ***；includeKeys=true 时导出明文。 */
export function exportConfig(includeKeys: boolean) {
  const providers = db.select().from(schema.providers).all();
  const models = db.select().from(schema.models).all();
  const aliases = db.select().from(schema.routeAliases).all();
  const prompts = db.select().from(schema.prompts).all();
  const slugById = new Map(providers.map((p) => [p.id, p.slug]));

  return {
    version: 2,
    exported_at: new Date().toISOString(),
    providers: providers.map((p) => ({
      slug: p.slug,
      name: p.name,
      protocol: p.protocol,
      base_url: p.baseUrl,
      api_key: includeKeys ? decrypt(p.apiKeyEnc) : MASKED_KEY,
      enabled: p.enabled === 1,
      priority: p.priority,
      balance_config: p.balanceConfig,
      remark: p.remark,
    })),
    models: models.map((m) => ({
      provider_slug: slugById.get(m.providerId),
      model_id: m.modelId,
      alias: m.alias,
      display_name: m.displayName,
      enabled: m.enabled === 1,
      input_price: m.inputPrice,
      output_price: m.outputPrice,
      cache_read_price: m.cacheReadPrice,
      cache_write_price: m.cacheWritePrice,
      pricing_source: m.pricingSource,
      pricing_source_ref: m.pricingSourceRef,
      pricing_synced_at: m.pricingSyncedAt,
      context_window: m.contextWindow,
      synced: m.synced === 1,
    })),
    aliases: aliases.map((a) => {
      let targets: { provider_slug: string | undefined; model_id: string }[] = [];
      try {
        targets = (JSON.parse(a.targets) as { provider_id: string; model_id: string }[]).map((t) => ({
          provider_slug: slugById.get(t.provider_id),
          model_id: t.model_id,
        }));
      } catch {
        // 忽略非法 targets
      }
      return { alias: a.alias, targets, enabled: a.enabled === 1 };
    }),
    prompts: prompts.map((p) => ({ name: p.name, content: p.content, description: p.description })),
    settings: { log_retention_days: getLogRetentionDays() },
  };
}

export interface ImportReport {
  providers: { added: number; skipped: { slug: string; reason: string }[] };
  models: { added: number; skipped: number };
  aliases: { added: number; skipped: { alias: string; reason: string }[] };
  prompts: { added: number; skipped: number };
}

/** 导入配置：按 slug / name / (provider,model_id) 冲突时跳过并报告。 */
export function importConfig(data: Record<string, any>): ImportReport {
  const report: ImportReport = {
    providers: { added: 0, skipped: [] },
    models: { added: 0, skipped: 0 },
    aliases: { added: 0, skipped: [] },
    prompts: { added: 0, skipped: 0 },
  };
  const now = Date.now();

  // providers
  for (const p of (data.providers as any[]) ?? []) {
    if (!p?.slug) {
      report.providers.skipped.push({ slug: String(p?.slug ?? '?'), reason: '缺少 slug' });
      continue;
    }
    if (db.select().from(schema.providers).where(eq(schema.providers.slug, p.slug)).get()) {
      report.providers.skipped.push({ slug: p.slug, reason: '已存在' });
      continue;
    }
    if (!p.api_key || p.api_key === MASKED_KEY) {
      report.providers.skipped.push({ slug: p.slug, reason: '导出时未包含 api_key' });
      continue;
    }
    db.insert(schema.providers)
      .values({
        id: crypto.randomUUID(),
        slug: p.slug,
        name: p.name ?? p.slug,
        protocol: p.protocol ?? 'openai',
        baseUrl: p.base_url,
        apiKeyEnc: encrypt(String(p.api_key)),
        enabled: p.enabled === false ? 0 : 1,
        priority: p.priority ?? 0,
        balanceConfig: p.balance_config ?? null,
        remark: p.remark ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    report.providers.added++;
  }

  const providerIdBySlug = new Map(db.select().from(schema.providers).all().map((p) => [p.slug, p.id]));

  // models
  for (const m of (data.models as any[]) ?? []) {
    const pid = providerIdBySlug.get(m?.provider_slug);
    if (!pid || !m?.model_id) {
      report.models.skipped++;
      continue;
    }
    const exists = db
      .select()
      .from(schema.models)
      .where(eq(schema.models.providerId, pid))
      .all()
      .some((x) => x.modelId === m.model_id);
    if (exists) {
      report.models.skipped++;
      continue;
    }
    if (m.alias && aliasTaken(m.alias)) {
      report.models.skipped++;
      continue;
    }
    db.insert(schema.models)
      .values({
        id: crypto.randomUUID(),
        providerId: pid,
        modelId: m.model_id,
        alias: m.alias ?? null,
        displayName: m.display_name ?? null,
        enabled: m.enabled === false ? 0 : 1,
        inputPrice: m.input_price ?? null,
        outputPrice: m.output_price ?? null,
        cacheReadPrice: m.cache_read_price ?? null,
        cacheWritePrice: m.cache_write_price ?? null,
        pricingSource: m.pricing_source ?? ((m.input_price != null || m.output_price != null) ? 'manual' : null),
        pricingSourceRef: m.pricing_source_ref ?? null,
        pricingSyncedAt: m.pricing_synced_at ?? null,
        contextWindow: m.context_window ?? null,
        synced: m.synced ? 1 : 0,
      })
      .run();
    report.models.added++;
  }

  // aliases
  for (const a of (data.aliases as any[]) ?? []) {
    if (!a?.alias || aliasTaken(a.alias)) {
      report.aliases.skipped.push({ alias: String(a?.alias ?? '?'), reason: '已存在或非法' });
      continue;
    }
    const targets: { provider_id: string; model_id: string }[] = [];
    let bad = false;
    for (const t of (a.targets as any[]) ?? []) {
      const pid = providerIdBySlug.get(t?.provider_slug);
      if (!pid || !t?.model_id) {
        bad = true;
        break;
      }
      targets.push({ provider_id: pid, model_id: t.model_id });
    }
    if (bad || targets.length === 0) {
      report.aliases.skipped.push({ alias: a.alias, reason: '目标引用的服务商不存在' });
      continue;
    }
    db.insert(schema.routeAliases)
      .values({ id: crypto.randomUUID(), alias: a.alias, targets: JSON.stringify(targets), enabled: a.enabled === false ? 0 : 1 })
      .run();
    report.aliases.added++;
  }

  // prompts
  for (const p of (data.prompts as any[]) ?? []) {
    if (!p?.name || !p?.content || db.select().from(schema.prompts).where(eq(schema.prompts.name, p.name)).get()) {
      report.prompts.skipped++;
      continue;
    }
    db.insert(schema.prompts)
      .values({ id: crypto.randomUUID(), name: p.name, content: p.content, description: p.description ?? null, createdAt: now, updatedAt: now })
      .run();
    report.prompts.added++;
  }

  // settings（仅非敏感项）
  const days = data.settings?.log_retention_days;
  if (days !== undefined) {
    const n = Number(days);
    if (Number.isInteger(n) && n >= 1 && n <= 3650) setSetting('log_retention_days', String(n));
  }

  return report;
}
