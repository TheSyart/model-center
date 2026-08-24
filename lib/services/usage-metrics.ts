export interface UsageInfo {
  /** 上游原始输入 Token；保留用于现有定价和兼容字段。 */
  prompt_tokens?: number;
  /** 上游原始输出 Token。 */
  completion_tokens?: number;
  /** 上游原始总 Token。 */
  total_tokens?: number;
  /** 不含缓存命中的普通输入 Token。 */
  uncached_input_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  /** true 表示上游明确返回了缓存相关字段（包括明确的 0）。 */
  cache_metrics_observed?: boolean;
}

type Json = Record<string, any>;

const DAY_MS = 86_400_000;

function tokenCount(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function hasOwn(object: unknown, key: string): boolean {
  return Boolean(object && typeof object === 'object' && Object.prototype.hasOwnProperty.call(object, key));
}

function baseUsage(prompt: unknown, completion: unknown, total: unknown): Pick<UsageInfo, 'prompt_tokens' | 'completion_tokens' | 'total_tokens'> {
  const promptTokens = tokenCount(prompt);
  const completionTokens = tokenCount(completion);
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: total == null ? promptTokens + completionTokens : tokenCount(total),
  };
}

export function normalizeOpenAIUsage(raw: Json | null | undefined): UsageInfo | null {
  if (!raw) return null;
  const base = baseUsage(raw.prompt_tokens ?? raw.input_tokens, raw.completion_tokens ?? raw.output_tokens, raw.total_tokens);
  const details = raw.prompt_tokens_details ?? raw.input_tokens_details;
  const cacheObserved =
    hasOwn(raw, 'prompt_cache_hit_tokens') ||
    hasOwn(raw, 'cache_read_tokens') ||
    hasOwn(raw, 'cache_creation_input_tokens') ||
    hasOwn(raw, 'cache_write_tokens') ||
    hasOwn(details, 'cached_tokens') ||
    hasOwn(details, 'cache_write_tokens');
  const cacheRead = tokenCount(raw.prompt_cache_hit_tokens ?? raw.cache_read_tokens ?? details?.cached_tokens);
  const cacheWrite = tokenCount(raw.cache_creation_input_tokens ?? raw.cache_write_tokens ?? details?.cache_write_tokens);
  const explicitUncached = raw.prompt_cache_miss_tokens ?? raw.uncached_input_tokens;
  const uncached = explicitUncached == null ? Math.max(0, (base.prompt_tokens ?? 0) - cacheRead) : tokenCount(explicitUncached);
  return {
    ...base,
    uncached_input_tokens: uncached,
    cache_read_tokens: cacheRead,
    cache_write_tokens: cacheWrite,
    cache_metrics_observed: cacheObserved,
  };
}

export function normalizeResponsesUsage(raw: Json | null | undefined): UsageInfo | null {
  if (!raw) return null;
  return normalizeOpenAIUsage({
    ...raw,
    prompt_tokens: raw.input_tokens,
    completion_tokens: raw.output_tokens,
    prompt_tokens_details: raw.input_tokens_details,
  });
}

export function normalizeAnthropicUsage(raw: Json | null | undefined): UsageInfo | null {
  if (!raw) return null;
  const base = baseUsage(raw.input_tokens, raw.output_tokens, raw.total_tokens);
  const cacheObserved = hasOwn(raw, 'cache_read_input_tokens') || hasOwn(raw, 'cache_creation_input_tokens');
  return {
    ...base,
    uncached_input_tokens: base.prompt_tokens ?? 0,
    cache_read_tokens: tokenCount(raw.cache_read_input_tokens),
    cache_write_tokens: tokenCount(raw.cache_creation_input_tokens),
    cache_metrics_observed: cacheObserved,
  };
}

export function normalizeGeminiUsage(raw: Json | null | undefined): UsageInfo | null {
  if (!raw) return null;
  const base = baseUsage(raw.promptTokenCount, raw.candidatesTokenCount, raw.totalTokenCount);
  const cacheObserved = hasOwn(raw, 'cachedContentTokenCount');
  const cacheRead = tokenCount(raw.cachedContentTokenCount);
  return {
    ...base,
    uncached_input_tokens: Math.max(0, (base.prompt_tokens ?? 0) - cacheRead),
    cache_read_tokens: cacheRead,
    cache_write_tokens: 0,
    cache_metrics_observed: cacheObserved,
  };
}

export function effectiveTokenTotal(usage: UsageInfo | null | undefined): number {
  if (!usage) return 0;
  if (usage.cache_metrics_observed) {
    return (
      tokenCount(usage.uncached_input_tokens) +
      tokenCount(usage.completion_tokens) +
      tokenCount(usage.cache_read_tokens) +
      tokenCount(usage.cache_write_tokens)
    );
  }
  return tokenCount(usage.total_tokens ?? tokenCount(usage.prompt_tokens) + tokenCount(usage.completion_tokens));
}

/** 只基于明确可观测缓存指标的输入计算命中率；历史未知数据不进入分母。 */
export function cacheHitRate(
  uncachedInputTokens: number,
  cacheReadTokens: number,
  observedRequests: number,
): number | null {
  if (tokenCount(observedRequests) === 0) return null;
  const uncached = tokenCount(uncachedInputTokens);
  const cached = tokenCount(cacheReadTokens);
  const total = uncached + cached;
  return total > 0 ? cached / total : null;
}

/** 只返回公开协议允许的 OpenAI usage 字段，避免内部统计字段泄漏给客户端。 */
export function toPublicUsage(usage: UsageInfo | null | undefined): Pick<UsageInfo, 'prompt_tokens' | 'completion_tokens' | 'total_tokens'> | null {
  if (!usage) return null;
  return {
    prompt_tokens: tokenCount(usage.prompt_tokens),
    completion_tokens: tokenCount(usage.completion_tokens),
    total_tokens: tokenCount(usage.total_tokens),
  };
}

export type UsageBucket = 'hour' | 'day';

export type UsageRangeValidation =
  | { ok: true; from: number; to: number; bucket: UsageBucket }
  | { ok: false; error: string };

export function validateUsageRange(from: number, to: number, bucket: string): UsageRangeValidation {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= 0) {
    return { ok: false, error: 'from 与 to 必须是有效的毫秒时间戳' };
  }
  if (from >= to) return { ok: false, error: 'from 必须早于 to' };
  if (to - from > 90 * DAY_MS) return { ok: false, error: '自定义时间范围不能超过 90 天' };
  if (bucket !== 'hour' && bucket !== 'day') return { ok: false, error: 'bucket 必须是 hour 或 day' };
  if (bucket === 'hour' && to - from > 48 * 3_600_000) return { ok: false, error: '小时粒度最多查询 48 小时' };
  return { ok: true, from, to, bucket };
}

/** 日粒度按服务器本地自然日对齐，并把归一化后的真实边界返回给 API 调用方。 */
export function normalizeUsageRangeForBucket(
  from: number,
  to: number,
  bucket: UsageBucket,
): { from: number; to: number; bucket: UsageBucket } {
  if (bucket === 'hour') return { from, to, bucket };
  const fromDate = new Date(from);
  const lastIncluded = new Date(to - 1);
  return {
    from: new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime(),
    to: new Date(lastIncluded.getFullYear(), lastIncluded.getMonth(), lastIncluded.getDate() + 1).getTime(),
    bucket,
  };
}

/**
 * 日志“来源”表示调用方原样上报的 User-Agent，而不是根据 UA 推断出的客户端类别。
 * 清理控制字符并限制快照长度，避免不可见字符破坏高密度日志表。
 */
export function normalizeRequestSource(userAgent: string | null | undefined): string {
  const value = (userAgent ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return value ? value.slice(0, 256) : 'unknown';
}

const REQUEST_CLIENTS: Array<{ key: string; name: string; pattern: RegExp }> = [
  { key: 'kimi-code', name: 'Kimi Code', pattern: /\bkimi[-_ ]?(?:code|cli)|kimi-code-cli/i },
  { key: 'claude-code', name: 'Claude Code', pattern: /\bclaude[-_ ]?(?:code|cli)|anthropic-cli/i },
  { key: 'cc-switch', name: 'CC Switch', pattern: /\bcc[-_ ]?switch\b/i },
  { key: 'gemini-cli', name: 'Gemini CLI', pattern: /\bgemini[-_ ]?cli\b|geminicli/i },
  { key: 'opencode', name: 'OpenCode', pattern: /\bopencode\b/i },
  { key: 'openclaw', name: 'OpenClaw', pattern: /\bopenclaw\b/i },
  { key: 'hermes', name: 'Hermes', pattern: /\bhermes(?:-agent)?\b/i },
  { key: 'pi', name: 'Pi', pattern: /\bpi(?:-agent|-coding-agent)?\//i },
  { key: 'grok-cli', name: 'Grok CLI', pattern: /\bgrok[-_ ]?(?:build|cli)\b/i },
  { key: 'codex', name: 'Codex', pattern: /\bcodex(?:_cli_rs|-cli|\/)/i },
  { key: 'openai-sdk', name: 'OpenAI SDK', pattern: /\bopenai-(?:node|python|go|java|dotnet)|\bopenai\//i },
  { key: 'anthropic-sdk', name: 'Anthropic SDK', pattern: /\banthropic-(?:typescript|python|go|java)|\banthropic\//i },
  { key: 'gemini-sdk', name: 'Gemini SDK', pattern: /\bgoogle-genai|generative-ai/i },
  { key: 'curl', name: 'cURL', pattern: /^curl\//i },
];

/** 日志筛选器使用的稳定客户端列表；“未知客户端”始终作为兜底项保留。 */
export const REQUEST_CLIENT_OPTIONS: ReadonlyArray<{ key: string; name: string }> = [
  ...REQUEST_CLIENTS.map(({ key, name }) => ({ key, name })),
  { key: 'unknown', name: '未知客户端' },
];

export function detectRequestClient(source: string | null | undefined): { key: string; name: string } {
  const normalized = normalizeRequestSource(source);
  for (const client of REQUEST_CLIENTS) {
    if (client.pattern.test(normalized)) return { key: client.key, name: client.name };
  }
  return { key: 'unknown', name: '未知客户端' };
}

export interface ActivityDay {
  day: string;
  requests: number;
  effective_tokens: number;
  cost: number;
}

function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function fillDailyActivity(rows: ActivityDay[], endTimestamp: number, days = 365): ActivityDay[] {
  const end = new Date(endTimestamp);
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1 - index));
    const day = localDayKey(date.getTime());
    return byDay.get(day) ?? { day, requests: 0, effective_tokens: 0, cost: 0 };
  });
}
