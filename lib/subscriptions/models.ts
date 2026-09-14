/** Account-authenticated model catalogs, one official listing endpoint per vendor.
 * Copilot: cc-switch 42ac174d (MIT) copilot_auth.rs. Codex: cc-switch codex_oauth_models.rs
 * and the openai/codex ModelInfo contract. Antigravity: CLIProxyAPI 7fa443dc
 * cmd/fetch_antigravity_models. Claude OAuth listing is corroborated only by third-party
 * clients and still needs real-account acceptance. No static fallback list exists: a
 * failed fetch is reported, and the operator can still enter model IDs by hand. */
import {
  ANTIGRAVITY_MODELS_URL,
  ANTIGRAVITY_USER_AGENT,
  CLAUDE_MODELS_URL,
  CLAUDE_USER_AGENT,
  CODEX_CLIENT_VERSION,
  CODEX_MODELS_URL,
  copilotApiBase,
  copilotClientHeaders,
  object,
  requestJson,
  safeString,
  SubscriptionError,
} from './oauth.ts';
import { isValidModelId } from './store.ts';
import {
  REASONING_EFFORTS,
  isReasoningEffort,
  type ModelReasoning,
  type ReasoningEffort,
} from '../gateway/reasoning.ts';
import { subscriptionFetch } from './transport.ts';
import type {
  Credential,
  DiscoveredModel,
  ModelDiscovery,
  ModelEndpoint,
  SubscriptionVendor,
} from './types.ts';

/** Codex entries embed long instructions, so catalogs outgrow the 1 MiB control-plane cap. */
const LIST_BYTES = 8 * 1024 * 1024;
const MAX_MODELS = 500;
const CLAUDE_PAGES = 10;
const invalid = () =>
  new SubscriptionError('invalid_response', 502, '上游模型列表格式无效');
const ANTIGRAVITY_EXCLUDED = new Set([
  'chat_20706',
  'chat_23310',
  'tab_flash_lite_preview',
  'tab_jump_flash_lite_preview',
]);
const NON_CHAT =
  /(?:^|[-_])(?:image|imagen|audio|tts|embedding|embed|video|veo)(?:[-_]|$)/i;

function collector() {
  const found = new Map<string, DiscoveredModel>();
  let skipped = 0;
  return {
    skip() {
      skipped++;
    },
    add(
      id: unknown,
      displayName: unknown,
      endpoints: ModelEndpoint[],
      reasoning?: ModelReasoning
    ) {
      const value = safeString(id, 200);
      if (!value || !isValidModelId(value) || !endpoints.length) {
        skipped++;
        return;
      }
      const existing = found.get(value);
      if (existing) {
        for (const endpoint of endpoints)
          if (!existing.endpoints.includes(endpoint))
            existing.endpoints.push(endpoint);
        return;
      }
      found.set(value, {
        id: value,
        displayName: safeString(displayName),
        endpoints: [...endpoints],
        ...(reasoning ? { reasoning } : {}),
      });
    },
    finish(source: string): ModelDiscovery {
      const models = [...found.values()].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      );
      if (!models.length)
        throw new SubscriptionError('no_models', 502, '上游未返回可用模型');
      const kept = models.slice(0, MAX_MODELS);
      return {
        models: kept,
        skipped: skipped + models.length - kept.length,
        source,
        checkedAt: Date.now(),
      };
    },
  };
}

const sortEfforts = (efforts: ReasoningEffort[]): ReasoningEffort[] =>
  [...new Set(efforts)].sort(
    (a, b) => REASONING_EFFORTS.indexOf(a) - REASONING_EFFORTS.indexOf(b)
  );

interface AntigravityEntry {
  id: string;
  displayName: string | null;
  maxOutputTokens?: number;
}

/** Irregular IDs Antigravity serves for one level, checked before the suffix rules.
 * Listed in preference order: OmniRoute reports the advertised gemini-3.1-pro-high slot
 * answering 400 while gemini-pro-agent serves the high tier. */
const ANTIGRAVITY_FIXED: Record<string, { base: string; effort: ReasoningEffort }> = {
  'gemini-pro-agent': { base: 'gemini-3.1-pro', effort: 'high' },
  'gemini-3.1-pro-high': { base: 'gemini-3.1-pro', effort: 'high' },
};
const EFFORT_SUFFIX = /^(.+)-(minimal|low|medium|high|xhigh|max)$/;
const LEVEL_LABEL = /\s*\((?:minimal|low|medium|high|xhigh|max|thinking)\)\s*$/i;
const cleanLabel = (name: string | null) =>
  name ? name.replace(LEVEL_LABEL, '') || null : null;

/**
 * Antigravity lists one model at several strengths as separate IDs. Fold them into a
 * base model whose reasoning metadata maps each level to its upstream ID, so clients
 * pick strength with the reasoning parameter; the old IDs stay callable via legacyIds.
 */
export function foldAntigravityVariants(entries: AntigravityEntry[]): DiscoveredModel[] {
  type Member = AntigravityEntry & {
    kind: 'base' | 'effort' | 'thinking' | 'tiered';
    effort?: ReasoningEffort;
  };
  const groups = new Map<string, Member[]>();
  for (const entry of entries) {
    const fixed = ANTIGRAVITY_FIXED[entry.id];
    const suffix = EFFORT_SUFFIX.exec(entry.id);
    let base = entry.id;
    let member: Member = { ...entry, kind: 'base' };
    if (fixed) {
      base = fixed.base;
      member = { ...entry, kind: 'effort', effort: fixed.effort };
    } else if (entry.id.endsWith('-thinking')) {
      base = entry.id.slice(0, -'-thinking'.length);
      member = { ...entry, kind: 'thinking' };
    } else if (entry.id.endsWith('-tiered')) {
      base = entry.id.slice(0, -'-tiered'.length);
      member = { ...entry, kind: 'tiered' };
    } else if (suffix) {
      base = suffix[1];
      member = { ...entry, kind: 'effort', effort: suffix[2] as ReasoningEffort };
    }
    groups.set(base, [...(groups.get(base) ?? []), member]);
  }
  const preference = Object.keys(ANTIGRAVITY_FIXED);
  const rank = (id: string) =>
    preference.includes(id) ? preference.indexOf(id) : preference.length;
  const folded: DiscoveredModel[] = [];
  for (const [base, members] of groups) {
    const control: ModelReasoning['control'] = base.startsWith('claude-')
      ? 'budget'
      : base.startsWith('gemini-')
        ? 'level'
        : 'none';
    const plain = members.find((m) => m.kind === 'base');
    const thinking = members.find((m) => m.kind === 'thinking');
    const tiered = members.find((m) => m.kind === 'tiered');
    const maxOutput = (thinking ?? plain ?? members[0]).maxOutputTokens;
    const budget =
      control === 'budget' && maxOutput && maxOutput > 1
        ? { budget: { max: maxOutput - 1 } }
        : {};
    if (plain && members.length === 1) {
      folded.push({
        id: base,
        displayName: cleanLabel(plain.displayName),
        endpoints: ['gemini'],
        ...(control === 'none' ? {} : { reasoning: { control, ...budget } }),
      });
      continue;
    }
    const variants: Partial<Record<ReasoningEffort, string>> = {};
    for (const m of [...members].sort((a, b) => rank(a.id) - rank(b.id)))
      if (m.kind === 'effort' && m.effort && !variants[m.effort]) variants[m.effort] = m.id;
    const levels = sortEfforts(Object.keys(variants).filter(isReasoningEffort));
    const upstreamDefault =
      plain?.id ??
      tiered?.id ??
      variants.high ??
      (levels.length ? variants[levels[levels.length - 1]] : undefined) ??
      thinking?.id ??
      base;
    const reasoning: ModelReasoning = {
      control,
      upstreamDefault,
      legacyIds: members.map((m) => m.id).filter((id) => id !== base),
      ...budget,
    };
    if (levels.length) reasoning.variants = variants;
    if (thinking && plain) reasoning.thinkingVariant = thinking.id;
    const label = members.find((m) => m.id === upstreamDefault) ?? members[0];
    folded.push({
      id: base,
      displayName: cleanLabel(label.displayName),
      endpoints: ['gemini'],
      reasoning,
    });
  }
  return folded;
}

const semver = (value: unknown): number[] | null => {
  const match =
    typeof value === 'string' ? /^(\d+)\.(\d+)\.(\d+)/.exec(value) : null;
  return match ? match.slice(1, 4).map(Number) : null;
};
/** ChatGPT lists models the sent client version cannot run; codex-rs hides those too. */
function requiresNewerCodex(minimal: unknown): boolean {
  const wanted = semver(minimal);
  const have = semver(CODEX_CLIENT_VERSION)!;
  if (!wanted) return false;
  for (let i = 0; i < 3; i++)
    if (wanted[i] !== have[i]) return wanted[i] > have[i];
  return false;
}

export async function fetchSubscriptionModels(
  vendor: SubscriptionVendor,
  credential: Credential,
  fetcher: typeof fetch = subscriptionFetch,
  signal?: AbortSignal
): Promise<ModelDiscovery> {
  const token = safeString(credential.accessToken, 32_768);
  if (!token || /\s/.test(token))
    throw new SubscriptionError('needs_reauth', 401, '登录已失效，请重新登录');
  const found = collector();
  if (vendor === 'copilot') {
    const base = copilotApiBase(credential);
    const body = await requestJson(
      `${base}/models`,
      {
        headers: { ...copilotClientHeaders(), Authorization: `Bearer ${token}` },
      },
      fetcher,
      signal,
      LIST_BYTES
    );
    if (!Array.isArray(body.data)) throw invalid();
    for (const item of body.data) {
      const model = object(item);
      const id = safeString(model.id, 200);
      const policy = object(model.policy).state;
      const type = object(model.capabilities).type;
      if (
        (typeof policy === 'string' && policy !== 'enabled') ||
        model.model_picker_enabled === false ||
        (typeof type === 'string' && type !== 'chat') ||
        (id && /embedding/i.test(id))
      ) {
        found.skip();
        continue;
      }
      // Copilot serves some models only through /responses. Without the field the
      // model predates that split and speaks chat completions.
      const supported = Array.isArray(model.supported_endpoints)
        ? model.supported_endpoints.filter(
            (endpoint): endpoint is string => typeof endpoint === 'string'
          )
        : null;
      const endpoints: ModelEndpoint[] = supported
        ? [
            ...(supported.includes('/chat/completions')
              ? (['openai'] as const)
              : []),
            ...(supported.includes('/responses')
              ? (['openai-responses'] as const)
              : []),
          ]
        : ['openai'];
      const supports = object(object(model.capabilities).supports);
      const efforts = Array.isArray(supports.reasoning_effort)
        ? sortEfforts(supports.reasoning_effort.filter(isReasoningEffort))
        : [];
      const minBudget = Number.isFinite(supports.min_thinking_budget)
        ? (supports.min_thinking_budget as number)
        : undefined;
      const maxBudget = Number.isFinite(supports.max_thinking_budget)
        ? (supports.max_thinking_budget as number)
        : undefined;
      const reasoning: ModelReasoning | undefined =
        efforts.length || minBudget !== undefined || maxBudget !== undefined
          ? {
              control: efforts.length ? 'level' : 'budget',
              ...(efforts.length ? { efforts } : {}),
              ...(minBudget !== undefined || maxBudget !== undefined
                ? {
                    budget: {
                      ...(minBudget !== undefined ? { min: minBudget } : {}),
                      ...(maxBudget !== undefined ? { max: maxBudget } : {}),
                    },
                  }
                : {}),
            }
          : undefined;
      found.add(id, model.name, endpoints, reasoning);
    }
    return found.finish(`GET ${new URL(base).host}/models`);
  }
  if (vendor === 'codex') {
    const accountId = safeString(credential.accountKey);
    const body = await requestJson(
      CODEX_MODELS_URL,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          originator: 'codex_cli_rs',
          version: CODEX_CLIENT_VERSION,
          'User-Agent': `codex_cli_rs/${CODEX_CLIENT_VERSION}`,
          ...(accountId ? { 'ChatGPT-Account-Id': accountId } : {}),
        },
      },
      fetcher,
      signal,
      LIST_BYTES
    );
    const list = Array.isArray(body.models)
      ? body.models
      : Array.isArray(body.data)
        ? body.data
        : null;
    if (!list) throw invalid();
    for (const item of list) {
      const model = object(item);
      if (
        (typeof model.visibility === 'string' && model.visibility !== 'list') ||
        requiresNewerCodex(model.minimal_client_version)
      ) {
        found.skip();
        continue;
      }
      const levels = Array.isArray(model.supported_reasoning_levels)
        ? sortEfforts(
            model.supported_reasoning_levels
              .map((level: unknown) => object(level).effort ?? level)
              .filter(isReasoningEffort)
          )
        : [];
      found.add(
        safeString(model.slug, 200) ?? safeString(model.id, 200) ?? model.model,
        model.display_name,
        ['openai-responses'],
        levels.length
          ? {
              control: 'level',
              efforts: levels,
              ...(isReasoningEffort(model.default_reasoning_level)
                ? { defaultEffort: model.default_reasoning_level }
                : {}),
            }
          : undefined
      );
    }
    return found.finish('GET chatgpt.com/backend-api/codex/models');
  }
  if (vendor === 'claude') {
    const headers = {
      Authorization: `Bearer ${token}`,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'oauth-2025-04-20',
      'User-Agent': CLAUDE_USER_AGENT,
    };
    const cursors = new Set<string>();
    let cursor: string | null = null;
    for (let page = 0; ; page++) {
      if (page >= CLAUDE_PAGES)
        throw new SubscriptionError('invalid_response', 502, '上游模型列表分页过多');
      const body = await requestJson(
        `${CLAUDE_MODELS_URL}?limit=1000${cursor ? `&after_id=${cursor}` : ''}`,
        { headers },
        fetcher,
        signal,
        LIST_BYTES
      );
      if (!Array.isArray(body.data)) throw invalid();
      for (const item of body.data) {
        const model = object(item);
        found.add(model.id, model.display_name, ['anthropic']);
      }
      if (body.has_more !== true) break;
      const last = safeString(body.last_id, 128);
      if (!last || !/^[A-Za-z0-9._-]+$/.test(last) || cursors.has(last))
        throw invalid();
      cursors.add(last);
      cursor = last;
    }
    return found.finish('GET api.anthropic.com/v1/models');
  }
  if (vendor === 'antigravity') {
    if (!credential.projectId)
      throw new SubscriptionError(
        'project_required',
        400,
        'Antigravity 账号缺少托管项目，请重新授权'
      );
    const body = await requestJson(
      ANTIGRAVITY_MODELS_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': ANTIGRAVITY_USER_AGENT,
          Accept: '*/*',
        },
        body: JSON.stringify({ project: credential.projectId }),
      },
      fetcher,
      signal,
      LIST_BYTES
    );
    const catalog = body.models;
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog))
      throw invalid();
    const entries: AntigravityEntry[] = [];
    for (const [id, raw] of Object.entries(catalog)) {
      const info = object(raw);
      if (
        info.isInternal === true ||
        ANTIGRAVITY_EXCLUDED.has(id) ||
        NON_CHAT.test(id) ||
        !isValidModelId(id)
      ) {
        found.skip();
        continue;
      }
      entries.push({
        id,
        displayName: safeString(info.displayName),
        ...(Number.isFinite(info.maxOutputTokens)
          ? { maxOutputTokens: info.maxOutputTokens as number }
          : {}),
      });
    }
    for (const model of foldAntigravityVariants(entries))
      found.add(model.id, model.displayName, ['gemini'], model.reasoning);
    return found.finish(
      'POST daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
    );
  }
  throw new SubscriptionError('invalid_vendor', 400, '该账号类型不支持自动拉取模型');
}
