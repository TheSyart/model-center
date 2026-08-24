import crypto from 'node:crypto';
import { db, schema } from '@/lib/db';
import { getPreset } from '@/lib/presets';
import { formatQuotaSummary, queryCodingPlan, type QuotaTier } from './coding-plan';
import type { ProviderRow } from './provider';

/** §8 余额查询统一抽象。 */
export interface BalanceResult {
  supported: boolean;
  /** money=金额余额（默认）；quota=Coding Plan 套餐配额档位 */
  type?: 'money' | 'quota';
  /** 解析后的可读摘要，如 "剩余 ¥12.34 / 总额 ¥100" */
  summary?: string;
  /** quota 类型的配额档位 */
  tiers?: QuotaTier[];
  /** 套餐等级（若有） */
  plan?: string;
  /** 原始返回 JSON（存入快照） */
  raw?: unknown;
  error?: string;
  /** 不支持时给前端的跳转链接 */
  console_url?: string;
}

interface CustomBalanceConfig {
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  json_path?: string;
  unit?: string;
}

const BALANCE_TIMEOUT_MS = 15_000;

/** 简版 JSONPath：点号分隔 + 数字下标，如 "data.balance_infos.0.total_balance"。 */
export function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * 余额端点 URL 解析：
 * - 完整 URL（http(s)://...）直接使用；
 * - '//path' 形式表示 origin 级端点（base_url 的 origin + path，用于余额端点不在 /v1 下的情况，如 DeepSeek）；
 * - 否则拼在 base_url 后。
 */
function resolveEndpoint(base: string, endpoint: string): string {
  if (/^https?:\/\//.test(endpoint)) return endpoint;
  if (endpoint.startsWith('//')) return new URL(base).origin + endpoint.slice(1);
  return base + endpoint;
}

async function fetchJson(url: string, headers: Record<string, string>, method = 'GET'): Promise<unknown> {
  const res = await fetch(url, { method, headers, signal: AbortSignal.timeout(BALANCE_TIMEOUT_MS) });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new Error(`上游返回 ${res.status}: ${text}`);
  }
  return res.json();
}

type Json = Record<string, any>;

/** 内置余额解析器（按 preset slug，端点信息来自 lib/presets.ts §3.1）。 */
const BUILTIN_PARSERS: Record<string, (base: string, apiKey: string) => Promise<{ summary: string; raw: unknown }>> = {
  // DeepSeek: GET https://api.deepseek.com/user/balance（origin 级，不在 /v1 下）
  // → { balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }] }
  deepseek: async (base, apiKey) => {
    const raw = (await fetchJson(resolveEndpoint(base, '//user/balance'), { Authorization: `Bearer ${apiKey}` })) as Json;
    const infos = (raw.balance_infos as Json[]) ?? [];
    const summary =
      infos
        .map((i) => {
          const symbol = i.currency === 'CNY' ? '¥' : i.currency === 'USD' ? '$' : `${i.currency} `;
          return `${symbol}${i.total_balance}（含赠送 ${symbol}${i.granted_balance}）`;
        })
        .join(' / ') || '无余额信息';
    return { summary: `剩余 ${summary}`, raw };
  },
  // Kimi: GET /users/me/balance → { data: { available_balance } }
  kimi: async (base, apiKey) => {
    const raw = (await fetchJson(`${base}/users/me/balance`, { Authorization: `Bearer ${apiKey}` })) as Json;
    return { summary: `剩余 ¥${raw.data?.available_balance ?? '?'}`, raw };
  },
  // SiliconFlow: GET /user/info → { data: { balance, totalBalance } }
  siliconflow: async (base, apiKey) => {
    const raw = (await fetchJson(`${base}/user/info`, { Authorization: `Bearer ${apiKey}` })) as Json;
    return { summary: `剩余 ¥${raw.data?.balance ?? '?'} / 总额 ¥${raw.data?.totalBalance ?? '?'}`, raw };
  },
  // OpenRouter: GET /auth/key → { data: { usage, limit, limit_remaining } }
  openrouter: async (base, apiKey) => {
    const raw = (await fetchJson(`${base}/auth/key`, { Authorization: `Bearer ${apiKey}` })) as Json;
    const d = raw.data ?? {};
    const summary =
      d.limit != null
        ? `已用 $${d.usage ?? '?'} / 限额 $${d.limit}（剩余 $${d.limit_remaining ?? '?'}）`
        : `已用 $${d.usage ?? '?'}（无限额）`;
    return { summary, raw };
  },
};

/**
 * 查询单个服务商余额/套餐。
 * 优先级：内置金额解析器（按 slug）> provider.balance_config 自定义（json_path 提取）
 * > Coding Plan 套餐（预设 codingPlan 标记或 base_url 模式检测）> 不支持。
 */
export async function queryBalance(provider: ProviderRow, apiKey: string): Promise<BalanceResult> {
  const base = provider.baseUrl.replace(/\/+$/, '');
  const preset = getPreset(provider.slug);

  // 1. 内置解析器
  const parser = BUILTIN_PARSERS[provider.slug];
  if (parser) {
    try {
      const { summary, raw } = await parser(base, apiKey);
      return { supported: true, type: 'money', summary, raw };
    } catch (e) {
      return { supported: true, type: 'money', error: e instanceof Error ? e.message : String(e) };
    }
  }

  // 2. 自定义 balance_config
  if (provider.balanceConfig) {
    let cfg: CustomBalanceConfig;
    try {
      cfg = JSON.parse(provider.balanceConfig);
    } catch {
      return { supported: false, error: 'balance_config JSON 非法' };
    }
    if (!cfg.endpoint) return { supported: false, error: 'balance_config 缺少 endpoint' };
    try {
      const raw = await fetchJson(resolveEndpoint(base, cfg.endpoint), { Authorization: `Bearer ${apiKey}`, ...cfg.headers }, cfg.method ?? 'GET');
      if (!cfg.json_path) return { supported: true, type: 'money', summary: JSON.stringify(raw).slice(0, 200), raw };
      const value = getByPath(raw, cfg.json_path);
      if (value === undefined) {
        return { supported: true, type: 'money', summary: `路径 ${cfg.json_path} 未取到值`, raw, error: 'json_path 未命中' };
      }
      return { supported: true, type: 'money', summary: `剩余 ${cfg.unit ?? ''}${value}`, raw };
    } catch (e) {
      return { supported: true, type: 'money', error: e instanceof Error ? e.message : String(e) };
    }
  }

  // 3. Coding Plan 套餐（配额档位，非金额）
  const vendor = preset?.codingPlan ?? undefined;
  const plan = await queryCodingPlan(provider.baseUrl, apiKey, vendor);
  if (plan.supported && plan.tiers) {
    const summary = formatQuotaSummary(plan.tiers);
    return { supported: true, type: 'quota', tiers: plan.tiers, plan: plan.plan, summary };
  }
  if (plan.error) {
    return { supported: plan.supported, type: 'quota', error: plan.error };
  }

  // 4. 不支持（附控制台链接）
  return {
    supported: false,
    console_url: preset?.consoleUrl,
    error: preset?.balance?.note ?? '该服务商不支持余额查询接口',
  };
}

/** 查询并写 balance_snapshots 快照（§8）。 */
export async function queryBalanceWithSnapshot(provider: ProviderRow, apiKey: string): Promise<BalanceResult> {
  const result = await queryBalance(provider, apiKey);
  if (result.supported && (result.raw !== undefined || result.summary)) {
    try {
      db.insert(schema.balanceSnapshots)
        .values({
          id: crypto.randomUUID(),
          providerId: provider.id,
          ts: Date.now(),
          raw: result.raw !== undefined ? JSON.stringify(result.raw).slice(0, 8000) : null,
          summary: result.summary ?? result.error ?? null,
        })
        .run();
    } catch (e) {
      console.error('[balance] 写快照失败:', e);
    }
  }
  return result;
}
