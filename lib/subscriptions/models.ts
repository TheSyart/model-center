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
    add(id: unknown, displayName: unknown, endpoints: ModelEndpoint[]) {
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
      found.add(id, model.name, endpoints);
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
      found.add(
        safeString(model.slug, 200) ?? safeString(model.id, 200) ?? model.model,
        model.display_name,
        ['openai-responses']
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
    for (const [id, raw] of Object.entries(catalog)) {
      const info = object(raw);
      if (
        info.isInternal === true ||
        ANTIGRAVITY_EXCLUDED.has(id) ||
        NON_CHAT.test(id)
      ) {
        found.skip();
        continue;
      }
      found.add(id, info.displayName, ['gemini']);
    }
    return found.finish(
      'POST daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
    );
  }
  throw new SubscriptionError('invalid_vendor', 400, '该账号类型不支持自动拉取模型');
}
