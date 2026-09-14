import { object, requestJson, safeString, SubscriptionError } from './oauth.ts';
import type {
  Credential,
  QuotaSnapshot,
  QuotaWindow,
  SubscriptionVendor,
} from './types.ts';

const number = (value: unknown, max = Infinity): number | null =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= max
    ? value
    : null;
function reset(value: unknown): number | null {
  if (typeof value === 'number') {
    const n = number(value);
    if (n === null) return null;
    const ms = n < 100_000_000_000 ? n * 1000 : n;
    return ms <= 8_640_000_000_000_000 ? ms : null;
  }
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    )
  )
    return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}
function window(
  id: string,
  label: string,
  used: unknown,
  resetAt: unknown,
  seconds: unknown,
  modelId: string | null = null
): QuotaWindow {
  const usedPercent = number(used, 100);
  return {
    id,
    label,
    modelId,
    usedPercent,
    remainingPercent: usedPercent === null ? null : 100 - usedPercent,
    resetAt: reset(resetAt),
    windowSeconds: number(seconds),
  };
}
const claudeKeys: Record<string, [string, number, string | null]> = {
  five_hour: ['5 小时', 18000, null],
  seven_day: ['7 天', 604800, null],
  seven_day_opus: ['Opus · 7 天', 604800, 'opus'],
  seven_day_sonnet: ['Sonnet · 7 天', 604800, 'sonnet'],
  seven_day_oauth_apps: ['OAuth 应用 · 7 天', 604800, null],
  seven_day_cowork: ['Cowork · 7 天', 604800, null],
  iguana_necktie: ['Fable · 7 天', 604800, 'fable'],
};
export async function fetchQuota(
  vendor: SubscriptionVendor,
  credential: Credential,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<QuotaSnapshot> {
  if (
    !safeString(credential.accessToken, 32_768) ||
    /\s/.test(credential.accessToken)
  )
    throw new SubscriptionError('needs_reauth', 401, '登录已失效，请重新登录');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credential.accessToken}`,
  };
  let body: Record<string, unknown>;
  const windows: QuotaWindow[] = [];
  let plan = credential.plan ?? null;
  if (vendor === 'claude') {
    headers['anthropic-beta'] = 'oauth-2025-04-20';
    body = await requestJson(
      'https://api.anthropic.com/api/oauth/usage',
      { headers },
      fetcher,
      signal
    );
    if (Array.isArray(body.limits) && body.limits.length > 100)
      throw new SubscriptionError('invalid_response', 502);
    const scoped = new Map<string, Record<string, unknown>>();
    if (Array.isArray(body.limits))
      for (const raw of body.limits) {
        const data = object(raw);
        const label = safeString(object(object(data.scope).model).display_name);
        if (data.kind !== 'weekly_scoped' || !label) continue;
        const key = label.toLowerCase();
        const previous = scoped.get(key);
        if (
          !previous ||
          (data.is_active === true && previous.is_active !== true)
        )
          scoped.set(key, data);
      }
    for (const [key, [label, seconds, model]] of Object.entries(claudeKeys)) {
      if (
        key === 'iguana_necktie' &&
        (scoped.has('fable') || scoped.has('fable 5'))
      )
        continue;
      if (
        !body[key] ||
        typeof body[key] !== 'object' ||
        Array.isArray(body[key])
      )
        continue;
      const data = object(body[key]);
      windows.push(
        window(key, label, data.utilization, data.resets_at, seconds, model)
      );
    }
    Array.from(scoped.values()).forEach((raw, i) => {
      const data = object(raw);
      const model = object(object(data.scope).model);
      const label = safeString(model.display_name);
      if (data.kind !== 'weekly_scoped' || !label) return;
      windows.push(
        window(
          `weekly_scoped:${i}`,
          `${label} · 7 天`,
          data.percent,
          data.resets_at,
          604800,
          safeString(model.id) ?? label
        )
      );
    });
  } else if (vendor === 'codex') {
    if (!safeString(credential.accountKey))
      throw new SubscriptionError('invalid_identity');
    headers['ChatGPT-Account-Id'] = credential.accountKey;
    body = await requestJson(
      'https://chatgpt.com/backend-api/wham/usage',
      { headers },
      fetcher,
      signal
    );
    plan = safeString(body.plan_type) ?? plan;
    const add = (key: string, label: string, value: unknown) => {
      const rate = object(value);
      for (const [field, suffix] of [
        ['primary_window', '主窗口'],
        ['secondary_window', '次窗口'],
      ] as const) {
        if (
          !rate[field] ||
          typeof rate[field] !== 'object' ||
          Array.isArray(rate[field])
        )
          continue;
        const w = object(rate[field]);
        windows.push(
          window(
            `${key}:${field}`,
            `${label} · ${suffix}`,
            w.used_percent,
            w.reset_at,
            w.limit_window_seconds
          )
        );
      }
    };
    add('rate_limit', 'Codex', body.rate_limit);
    add('code_review_rate_limit', '代码审查', body.code_review_rate_limit);
    if (
      Array.isArray(body.additional_rate_limits) &&
      body.additional_rate_limits.length > 100
    )
      throw new SubscriptionError('invalid_response', 502);
    if (Array.isArray(body.additional_rate_limits))
      body.additional_rate_limits.forEach((raw, i) => {
        const d = object(raw);
        add(
          `additional:${i}`,
          safeString(d.limit_name) ??
            safeString(d.metered_feature) ??
            `附加额度 ${i + 1}`,
          d.rate_limit
        );
      });
  } else if (vendor === 'antigravity') {
    if (!safeString(credential.projectId))
      throw new SubscriptionError(
        'project_required',
        400,
        'Antigravity 账号缺少托管项目，请重新授权'
      );
    body = await requestJson(
      'https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary',
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'User-Agent':
            'antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)',
        },
        body: JSON.stringify({ project: credential.projectId }),
      },
      fetcher,
      signal
    );
    if (!Array.isArray(body.groups) || body.groups.length > 100)
      throw new SubscriptionError(
        'invalid_response',
        502,
        'Antigravity 未返回额度分组'
      );
    for (const [gi, rawGroup] of body.groups.entries()) {
      const group = object(rawGroup);
      if (!Array.isArray(group.buckets) || group.buckets.length > 100)
        throw new SubscriptionError(
          'invalid_response',
          502,
          'Antigravity 额度窗口格式无效'
        );
      const label =
        safeString(group.displayName ?? group.display_name) ??
        `额度组 ${gi + 1}`;
      for (const [bi, raw] of group.buckets.entries()) {
        const data = object(raw);
        const value = data.remainingFraction ?? data.remaining_fraction;
        const fraction = number(
          typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)
            ? Number(value)
            : value,
          1
        );
        const period = safeString(data.window)?.toLowerCase();
        const seconds = ['5h', 'five-hour', 'five_hour'].includes(period ?? '')
          ? 18000
          : ['week', 'weekly'].includes(period ?? '')
            ? 604800
            : null;
        const w = window(
          `antigravity:${gi}:${safeString(data.bucketId ?? data.bucket_id) ?? bi}`,
          `${label} · ${safeString(data.displayName ?? data.display_name) ?? period ?? '额度'}`,
          fraction === null ? null : (1 - fraction) * 100,
          data.resetTime ?? data.reset_time,
          seconds
        );
        w.remainingPercent = fraction === null ? null : fraction * 100;
        windows.push(w);
      }
    }
  } else if (vendor === 'gemini') {
    if (!safeString(credential.projectId))
      throw new SubscriptionError(
        'project_required',
        400,
        '需要 Google Cloud 项目 ID'
      );
    headers['Content-Type'] = 'application/json';
    body = await requestJson(
      'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ project: credential.projectId }),
      },
      fetcher,
      signal
    );
    if (!Array.isArray(body.buckets) || body.buckets.length > 500)
      throw new SubscriptionError(
        'invalid_response',
        502,
        '上游未返回额度窗口'
      );
    body.buckets.forEach((raw, i) => {
      const data = object(raw);
      const model = safeString(data.modelId);
      const type = safeString(data.tokenType);
      const fraction = number(data.remainingFraction, 1);
      const w = window(
        `bucket:${model ?? 'unknown'}:${type ?? 'unknown'}:${i}`,
        [model ?? 'Gemini', type].filter(Boolean).join(' · '),
        fraction === null ? null : (1 - fraction) * 100,
        data.resetTime,
        null,
        model
      );
      w.remainingPercent = fraction === null ? null : fraction * 100;
      windows.push(w);
    });
  } else throw new SubscriptionError('invalid_vendor');
  if (windows.length === 0)
    throw new SubscriptionError('invalid_response', 502, '上游未返回额度窗口');
  return { checkedAt: Date.now(), plan, windows };
}
