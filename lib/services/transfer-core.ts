import type Database from 'better-sqlite3';
import type { ProviderPreset } from '../presets/types.ts';
import { listProviderEndpoints, replaceProviderEndpoints } from './provider-endpoint.ts';
import { resolveEndpointSetForCreate } from './provider-endpoint-request.ts';

export const MASKED_TRANSFER_KEY = '***';

export interface TransferDependencies {
  sqlite: Database.Database;
  getPreset: (key: string) => ProviderPreset | undefined;
  encrypt: (value: string) => string;
  decrypt: (value: string) => string;
  randomId: () => string;
  now: () => number;
  getLogRetentionDays: () => number;
  setSetting: (key: string, value: string) => void;
  validateBaseUrl: (baseUrl: string) => string | null;
}

export interface ImportReport {
  providers: { added: number; skipped: { slug: string; reason: string }[] };
  models: { added: number; skipped: number };
  aliases: { added: number; skipped: { alias: string; reason: string }[] };
  prompts: { added: number; skipped: number };
}

export interface TransferService {
  exportConfig(includeKeys: boolean): ExportedConfig;
  importConfig(data: Record<string, unknown> | ExportedConfig): ImportReport;
}

export interface ExportedConfig {
  version: 3;
  exported_at: string;
  providers: Array<{
    slug: unknown;
    name: unknown;
    preset_key: unknown;
    default_protocol: unknown;
    endpoints: Array<{ protocol: string; base_url: string; enabled: boolean }>;
    protocol: unknown;
    base_url: unknown;
    api_key: string;
    enabled: boolean;
    priority: unknown;
    balance_config: unknown;
    remark: unknown;
  }>;
  models: Array<Record<string, unknown>>;
  aliases: Array<Record<string, unknown>>;
  prompts: Array<Record<string, unknown>>;
  settings: { log_retention_days: number };
}

function truthy(value: unknown): boolean {
  return value !== false;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function nonEmptyRawText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];
}

function providerExists(sqlite: Database.Database, slug: string): boolean {
  return !!sqlite.prepare('SELECT 1 FROM providers WHERE slug = ?').get(slug);
}

export function createTransferService(deps: TransferDependencies): TransferService {
  const { sqlite } = deps;

  function exportConfig(includeKeys: boolean): ExportedConfig {
    const providers = sqlite.prepare('SELECT * FROM providers ORDER BY created_at ASC, slug ASC').all() as Array<Record<string, unknown>>;
    const models = sqlite.prepare('SELECT * FROM models ORDER BY model_id ASC').all() as Array<Record<string, unknown>>;
    const aliases = sqlite.prepare('SELECT * FROM route_aliases ORDER BY alias ASC').all() as Array<Record<string, unknown>>;
    const prompts = sqlite.prepare('SELECT * FROM prompts ORDER BY name ASC').all() as Array<Record<string, unknown>>;
    const slugById = new Map(providers.map((provider) => [String(provider.id), String(provider.slug)]));

    return {
      version: 3,
      exported_at: new Date().toISOString(),
      providers: providers.map((provider) => {
        const endpoints = listProviderEndpoints(sqlite, String(provider.id));
        const defaultEndpoint = endpoints.find((endpoint) => endpoint.enabled && endpoint.isDefault);
        return {
          slug: provider.slug,
          name: provider.name,
          preset_key: provider.preset_key ?? null,
          default_protocol: defaultEndpoint?.protocol ?? provider.protocol,
          endpoints: endpoints.map((endpoint) => ({ protocol: endpoint.protocol, base_url: endpoint.baseUrl, enabled: endpoint.enabled })),
          protocol: defaultEndpoint?.protocol ?? provider.protocol,
          base_url: defaultEndpoint?.baseUrl ?? provider.base_url,
          api_key: includeKeys ? deps.decrypt(String(provider.api_key_enc)) : MASKED_TRANSFER_KEY,
          enabled: provider.enabled === 1,
          priority: provider.priority,
          balance_config: provider.balance_config ?? null,
          remark: provider.remark ?? null,
        };
      }),
      models: models.map((model) => ({
        provider_slug: slugById.get(String(model.provider_id)), model_id: model.model_id, alias: model.alias,
        display_name: model.display_name, enabled: model.enabled === 1, input_price: model.input_price,
        output_price: model.output_price, cache_read_price: model.cache_read_price, cache_write_price: model.cache_write_price,
        pricing_source: model.pricing_source, pricing_source_ref: model.pricing_source_ref,
        pricing_synced_at: model.pricing_synced_at, context_window: model.context_window, synced: model.synced === 1,
      })),
      aliases: aliases.map((alias) => {
        let targets: Array<{ provider_slug: string | undefined; model_id: string }> = [];
        try {
          targets = (JSON.parse(String(alias.targets)) as Array<{ provider_id: string; model_id: string }>).map((target) => ({
            provider_slug: slugById.get(target.provider_id), model_id: target.model_id,
          }));
        } catch {
          // Historical malformed target values remain omitted from portable exports.
        }
        return { alias: alias.alias, targets, enabled: alias.enabled === 1 };
      }),
      prompts: prompts.map((prompt) => ({ name: prompt.name, content: prompt.content, description: prompt.description ?? null })),
      settings: { log_retention_days: deps.getLogRetentionDays() },
    };
  }

  function importConfig(data: Record<string, unknown> | ExportedConfig): ImportReport {
    const report: ImportReport = {
      providers: { added: 0, skipped: [] }, models: { added: 0, skipped: 0 },
      aliases: { added: 0, skipped: [] }, prompts: { added: 0, skipped: 0 },
    };

    for (const row of asRows(data.providers)) {
      const slug = text(row.slug);
      if (!slug) { report.providers.skipped.push({ slug: String(row.slug ?? '?'), reason: '缺少 slug' }); continue; }
      if (providerExists(sqlite, slug)) { report.providers.skipped.push({ slug, reason: '已存在' }); continue; }
      const apiKey = text(row.api_key);
      if (!apiKey || apiKey === MASKED_TRANSFER_KEY) { report.providers.skipped.push({ slug, reason: '导出时未包含 api_key' }); continue; }

      try {
        const presetKey = text(row.preset_key) ?? undefined;
        const preset = presetKey ? deps.getPreset(presetKey) : undefined;
        const endpoints = resolveEndpointSetForCreate(
          { preset_key: presetKey, endpoints: row.endpoints, default_protocol: row.default_protocol, protocol: row.protocol, base_url: row.base_url },
          deps.getPreset, deps.validateBaseUrl,
        );
        const defaultEndpoint = endpoints.find((endpoint) => endpoint.is_default)!;
        const now = deps.now();
        const providerId = deps.randomId();
        sqlite.transaction(() => {
          sqlite.prepare(`INSERT INTO providers
            (id, slug, name, protocol, base_url, preset_key, api_key_enc, enabled, priority, balance_config, remark, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(providerId, slug, text(row.name) || preset?.name || slug, defaultEndpoint.protocol, defaultEndpoint.base_url,
              preset?.presetKey ?? null, deps.encrypt(apiKey), truthy(row.enabled) ? 1 : 0,
              typeof row.priority === 'number' ? row.priority : 0, row.balance_config ?? null, text(row.remark) ?? null, now, now);
          replaceProviderEndpoints(sqlite, providerId, endpoints, now, deps.validateBaseUrl);
        })();
        report.providers.added++;
      } catch (error) {
        report.providers.skipped.push({ slug, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    const providerIdBySlug = new Map((sqlite.prepare('SELECT id, slug FROM providers').all() as Array<{ id: string; slug: string }>).map((provider) => [provider.slug, provider.id]));
    for (const model of asRows(data.models)) {
      const providerId = providerIdBySlug.get(text(model.provider_slug) ?? '');
      const modelId = text(model.model_id);
      const alias = text(model.alias);
      const aliasTaken = alias && sqlite.prepare('SELECT 1 FROM models WHERE alias = ? UNION SELECT 1 FROM route_aliases WHERE alias = ?').get(alias);
      if (!providerId || !modelId || aliasTaken || sqlite.prepare('SELECT 1 FROM models WHERE provider_id = ? AND model_id = ?').get(providerId, modelId)) {
        report.models.skipped++; continue;
      }
      sqlite.prepare(`INSERT INTO models
        (id, provider_id, model_id, alias, display_name, enabled, input_price, output_price, cache_read_price, cache_write_price, pricing_source, pricing_source_ref, pricing_synced_at, context_window, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(deps.randomId(), providerId, modelId, alias ?? null, text(model.display_name) ?? null, truthy(model.enabled) ? 1 : 0,
          model.input_price ?? null, model.output_price ?? null, model.cache_read_price ?? null, model.cache_write_price ?? null,
          model.pricing_source ?? ((model.input_price != null || model.output_price != null) ? 'manual' : null), model.pricing_source_ref ?? null,
          model.pricing_synced_at ?? null, model.context_window ?? null, model.synced ? 1 : 0);
      report.models.added++;
    }

    for (const alias of asRows(data.aliases)) {
      const aliasName = text(alias.alias);
      const existing = aliasName && sqlite.prepare('SELECT 1 FROM route_aliases WHERE alias = ? UNION SELECT 1 FROM models WHERE alias = ?').get(aliasName);
      if (!aliasName || existing) { report.aliases.skipped.push({ alias: aliasName ?? '?', reason: '已存在或非法' }); continue; }
      const targets: Array<{ provider_id: string; model_id: string }> = [];
      let invalid = false;
      for (const target of asRows(alias.targets)) {
        const providerId = providerIdBySlug.get(text(target.provider_slug) ?? '');
        const modelId = text(target.model_id);
        if (!providerId || !modelId) { invalid = true; break; }
        targets.push({ provider_id: providerId, model_id: modelId });
      }
      if (invalid || targets.length === 0) { report.aliases.skipped.push({ alias: aliasName, reason: '目标引用的服务商不存在' }); continue; }
      sqlite.prepare('INSERT INTO route_aliases (id, alias, targets, enabled) VALUES (?, ?, ?, ?)')
        .run(deps.randomId(), aliasName, JSON.stringify(targets), truthy(alias.enabled) ? 1 : 0);
      report.aliases.added++;
    }

    for (const prompt of asRows(data.prompts)) {
      const name = text(prompt.name);
      const content = nonEmptyRawText(prompt.content);
      if (!name || !content || sqlite.prepare('SELECT 1 FROM prompts WHERE name = ?').get(name)) { report.prompts.skipped++; continue; }
      const now = deps.now();
      sqlite.prepare('INSERT INTO prompts (id, name, content, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(deps.randomId(), name, content, text(prompt.description) ?? null, now, now);
      report.prompts.added++;
    }

    const settings = data.settings;
    if (settings && typeof settings === 'object') {
      const days = Number((settings as Record<string, unknown>).log_retention_days);
      if (Number.isInteger(days) && days >= 1 && days <= 3650) deps.setSetting('log_retention_days', String(days));
    }
    return report;
  }

  return { exportConfig, importConfig };
}
