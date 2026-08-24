/**
 * Coding Plan 套餐配额查询（移植自 cc-switch src-tauri/src/services/coding_plan.rs）。
 * 与余额（金额）不同，套餐返回的是配额档位（5 小时窗 / 周限额等）。
 * 火山方舟套餐需控制面 OpenAPI AK/SK 签名，与推理 Key 两套凭据，v1 不支持。
 */

export interface QuotaTier {
  /** five_hour / weekly_limit */
  name: string;
  /** 已用百分比 0-100 */
  utilization: number;
  /** 重置时间（ISO 8601），无则 null */
  resets_at: string | null;
}

const QUOTA_TIER_ORDER: Record<string, number> = {
  five_hour: 0,
  weekly_limit: 1,
};

const QUOTA_TIER_LABELS: Record<string, string> = {
  five_hour: '5小时',
  weekly_limit: '7天',
};

/** 将套餐档位格式化为紧凑、稳定的“窗口 + 已用百分比”摘要。 */
export function formatQuotaSummary(tiers: readonly QuotaTier[]): string {
  if (tiers.length === 0) return '套餐额度暂无数据';

  return [...tiers]
    .sort(
      (a, b) =>
        (QUOTA_TIER_ORDER[a.name] ?? Number.MAX_SAFE_INTEGER) -
          (QUOTA_TIER_ORDER[b.name] ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name),
    )
    .map((tier) => {
      const utilization = Math.round(Math.min(100, Math.max(0, tier.utilization)));
      return `${QUOTA_TIER_LABELS[tier.name] ?? tier.name} ${utilization}%`;
    })
    .join(' · ');
}

export type CodingPlanVendor = 'kimi' | 'zhipu' | 'minimax-cn' | 'minimax-en' | 'zenmux' | 'volcengine';

/** 按 base_url 模式检测套餐厂商（与 cc-switch detect_provider 对齐）。 */
export function detectCodingPlan(baseUrl: string): CodingPlanVendor | null {
  const url = baseUrl.toLowerCase();
  if (url.includes('api.kimi.com/coding')) return 'kimi';
  if (url.includes('bigmodel.cn')) return 'zhipu';
  if (url.includes('api.z.ai')) return 'zhipu';
  if (url.includes('api.minimaxi.com')) return 'minimax-cn';
  if (url.includes('api.minimax.io')) return 'minimax-en';
  if (url.includes('zenmux')) return 'zenmux';
  if (url.includes('volces.com/api/plan') || url.includes('volces.com/api/coding')) return 'volcengine';
  return null;
}

/** resetTime 兼容：字符串直返；数字自适应秒/毫秒；<=0 视为无。 */
function extractResetTime(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0) return null;
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  return null;
}

/** 数字/字符串数字兼容解析。 */
function parseNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type Json = Record<string, any>;

const TIMEOUT = 15_000;

async function fetchJson(url: string, headers: Record<string, string>): Promise<{ ok: boolean; status: number; json: Json }> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT) });
  const text = await res.text();
  let json: Json = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`响应不是合法 JSON（HTTP ${res.status}）: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`上游返回 ${res.status}: ${text.slice(0, 300)}`);
  return { ok: true, status: res.status, json };
}

function utilizationFrom(limit: unknown, remaining: unknown): number {
  const l = parseNum(limit) ?? 1;
  const r = parseNum(remaining) ?? 0;
  const used = Math.max(0, l - r);
  return l > 0 ? (used / l) * 100 : 0;
}

// ---------- Kimi For Coding：GET {origin}/coding/v1/usages，Bearer ----------
async function queryKimi(baseUrl: string, apiKey: string): Promise<{ tiers: QuotaTier[] }> {
  const url = new URL('/coding/v1/usages', baseUrl).toString();
  const { json } = await fetchJson(url, { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' });
  const tiers: QuotaTier[] = [];
  for (const item of (json.limits as Json[]) ?? []) {
    const d = item.detail;
    if (!d) continue;
    tiers.push({
      name: 'five_hour',
      utilization: utilizationFrom(d.limit, d.remaining),
      resets_at: extractResetTime(d.resetTime),
    });
  }
  if (json.usage) {
    tiers.push({
      name: 'weekly_limit',
      utilization: utilizationFrom(json.usage.limit, json.usage.remaining),
      resets_at: extractResetTime(json.usage.resetTime),
    });
  }
  return { tiers };
}

// ---------- 智谱 GLM：GET {origin}/api/monitor/usage/quota/limit，Authorization 不带 Bearer ----------
async function queryZhipu(baseUrl: string, apiKey: string): Promise<{ tiers: QuotaTier[]; plan?: string }> {
  const origin = new URL(baseUrl).origin;
  const { json } = await fetchJson(`${origin}/api/monitor/usage/quota/limit`, {
    Authorization: apiKey, // 智谱不加 Bearer 前缀
    'Content-Type': 'application/json',
    'Accept-Language': 'en-US,en',
  });
  if (json.success === false) throw new Error(`API error: ${json.msg ?? 'Unknown error'}`);
  const data = json.data;
  if (!data) throw new Error("响应缺少 'data' 字段");

  // 分类优先级：unit 字段（3=5小时窗，6=周窗）；缺失时无 nextResetTime 的优先归 five_hour，其余按 reset 升序
  type Entry = { resetMs: number | null; percentage: number; resetsAt: string | null };
  let fiveHour: Entry | null = null;
  let weekly: Entry | null = null;
  const unclassified: Entry[] = [];
  for (const item of (data.limits as Json[]) ?? []) {
    const type = String(item.type ?? '');
    if (!/^(TOKENS_LIMIT|CREDIT_LIMIT)$/i.test(type)) continue;
    const entry: Entry = {
      resetMs: typeof item.nextResetTime === 'number' ? item.nextResetTime : null,
      percentage: parseNum(item.percentage) ?? 0,
      resetsAt: extractResetTime(item.nextResetTime),
    };
    if (item.unit === 3 && !fiveHour) fiveHour = entry;
    else if (item.unit === 6 && !weekly) weekly = entry;
    else unclassified.push(entry);
  }
  unclassified.sort((a, b) => (a.resetMs == null ? -1 : 1) - (b.resetMs == null ? -1 : 1) || (a.resetMs ?? 0) - (b.resetMs ?? 0));
  for (const e of unclassified) {
    if (!fiveHour) fiveHour = e;
    else if (!weekly) weekly = e;
  }
  const tiers: QuotaTier[] = [];
  if (fiveHour) tiers.push({ name: 'five_hour', utilization: fiveHour.percentage, resets_at: fiveHour.resetsAt });
  if (weekly) tiers.push({ name: 'weekly_limit', utilization: weekly.percentage, resets_at: weekly.resetsAt });
  return { tiers, plan: data.level };
}

// ---------- MiniMax：GET {origin}/v1/api/openplatform/coding_plan/remains，Bearer；剩余百分比反转为已用 ----------
async function queryMinimax(baseUrl: string, apiKey: string): Promise<{ tiers: QuotaTier[] }> {
  const origin = new URL(baseUrl).origin;
  const { json } = await fetchJson(`${origin}/v1/api/openplatform/coding_plan/remains`, {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  });
  const baseResp = json.base_resp;
  if (baseResp && (baseResp.status_code ?? -1) !== 0) {
    throw new Error(`API error (code ${baseResp.status_code}): ${baseResp.status_msg ?? 'Unknown error'}`);
  }
  const tiers: QuotaTier[] = [];
  const item = ((json.model_remains as Json[]) ?? []).find((m) => m.model_name === 'general');
  if (item) {
    const remain5h = parseNum(item.current_interval_remaining_percent);
    if (remain5h != null) {
      tiers.push({ name: 'five_hour', utilization: 100 - remain5h, resets_at: extractResetTime(item.end_time) });
    }
    if (item.current_weekly_status === 1) {
      const remainW = parseNum(item.current_weekly_remaining_percent);
      if (remainW != null) {
        tiers.push({ name: 'weekly_limit', utilization: 100 - remainW, resets_at: extractResetTime(item.weekly_end_time) });
      }
    }
  }
  return { tiers };
}

// ---------- ZenMux：GET {base_url}（base_url 即查询端点），Bearer ----------
async function queryZenmux(baseUrl: string, apiKey: string): Promise<{ tiers: QuotaTier[]; plan?: string }> {
  const { json } = await fetchJson(baseUrl, { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' });
  if (json.success !== true) throw new Error(`API error: ${json.message ?? 'Unknown error'}`);
  const data = json.data;
  if (!data) throw new Error("响应缺少 'data' 字段");
  const tiers: QuotaTier[] = [];
  const push = (q: Json | undefined, name: string) => {
    if (!q) return;
    tiers.push({
      name,
      utilization: (parseNum(q.usage_percentage) ?? 0) * 100,
      resets_at: typeof q.resets_at === 'string' ? q.resets_at : null,
    });
  };
  push(data.quota_5_hour, 'five_hour');
  push(data.quota_7_day, 'weekly_limit');
  const tier = data.plan?.tier;
  const plan = tier ? `${tier}${data.account_status ? ` (${data.account_status})` : ''}` : undefined;
  return { tiers, plan };
}

export interface CodingPlanResult {
  supported: boolean;
  tiers?: QuotaTier[];
  plan?: string;
  error?: string;
}

/** 查询套餐配额。volcengine 需 AK/SK 签名，v1 不支持。 */
export async function queryCodingPlan(baseUrl: string, apiKey: string, vendorOverride?: string | null): Promise<CodingPlanResult> {
  const vendor = (vendorOverride as CodingPlanVendor | null) ?? detectCodingPlan(baseUrl);
  if (!vendor) return { supported: false };
  if (vendor === 'volcengine') {
    return { supported: false, error: '火山方舟套餐需控制面 AK/SK 签名（与推理 Key 不同），暂不支持' };
  }
  try {
    if (vendor === 'kimi') return { supported: true, ...(await queryKimi(baseUrl, apiKey)) };
    if (vendor === 'zhipu') return { supported: true, ...(await queryZhipu(baseUrl, apiKey)) };
    if (vendor === 'zenmux') return { supported: true, ...(await queryZenmux(baseUrl, apiKey)) };
    return { supported: true, ...(await queryMinimax(baseUrl, apiKey)) };
  } catch (e) {
    return { supported: true, error: e instanceof Error ? e.message : String(e) };
  }
}
