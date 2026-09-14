/** Protocol contracts: CLIProxyAPI 7fa443dc (MIT), Google Gemini CLI 9c1b0a61
 * (Apache-2.0). Independent implementation; see subscription accounts design sources. */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Authorization, Credential, SubscriptionVendor } from './types.ts';
import { subscriptionFetch } from './transport.ts';

export class SubscriptionError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400, message = '订阅服务请求失败') {
    super(message);
    this.name = 'SubscriptionError';
    this.code = code;
    this.status = status;
  }
}
export const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const safeString = (value: unknown, max = 256): string | null =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= max &&
  !/[\x00-\x1f\x7f]/.test(value)
    ? value
    : null;
export const ANTIGRAVITY_VERSION = '2.9.1';
export const ANTIGRAVITY_USER_AGENT = `antigravity/hub/${ANTIGRAVITY_VERSION} darwin/arm64`;
interface DeviceConfig {
  /** The page the operator opens and types the user code into. Pinned, never taken
   * from the upstream response: that would hand browser navigation to the upstream. */
  verification: string;
  start: string;
  poll: string;
}
interface VendorConfig {
  /** Absent for device-only vendors. */
  authorize?: string;
  token: string;
  /** Present when the client id is a public constant rather than deployment config. */
  client?: string;
  redirect: string;
  scope: string;
  device?: DeviceConfig;
}
const config: Record<SubscriptionVendor, VendorConfig> = {
  claude: {
    authorize: 'https://claude.ai/oauth/authorize',
    token: 'https://platform.claude.com/v1/oauth/token',
    client: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
    redirect: 'http://localhost:54545/callback',
    scope:
      'user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload',
  },
  codex: {
    authorize: 'https://auth.openai.com/oauth/authorize',
    token: 'https://auth.openai.com/oauth/token',
    client: 'app_EMoamEEZ73f0CkXaXp7hrann',
    redirect: 'http://localhost:1455/auth/callback',
    scope: 'openid email profile offline_access',
  },
  antigravity: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    redirect: 'http://localhost:51121/oauth-callback',
    scope:
      'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs',
  },
  gemini: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    redirect: 'https://codeassist.google.com/authcode',
    scope:
      'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
  },
  copilot: {
    // Device flow only: the public client id the editor Copilot extensions use.
    // Not a secret, and GitHub registers no browser redirect for it.
    token: 'https://github.com/login/oauth/access_token',
    client: 'Iv1.b507a08c87ecfe98',
    redirect: '',
    scope: 'read:user',
    device: {
      verification: 'https://github.com/login/device',
      start: 'https://github.com/login/device/code',
      poll: 'https://github.com/login/oauth/access_token',
    },
  },
};
/** Copilot client identity and per-seat inference hosts follow cc-switch 42ac174d (MIT). */
export const COPILOT_API = 'https://api.githubcopilot.com';
export const COPILOT_PLUGIN_VERSION = 'copilot-chat/0.38.2';
export const COPILOT_EDITOR_VERSION = 'vscode/1.110.1';
export const COPILOT_USER_AGENT = 'GitHubCopilotChat/0.38.2';
export const COPILOT_API_VERSION = '2025-10-01';
/** Individual, business and enterprise seats each have their own inference host.
 * GitHub Enterprise Server hosts are deliberately not admitted. */
const COPILOT_API_HOST =
  /^https:\/\/api(?:\.(?:individual|business|enterprise))?\.githubcopilot\.com$/;
const copilotSessionUrl = 'https://api.github.com/copilot_internal/v2/token';
const githubUserUrl = 'https://api.github.com/user';
export const COPILOT_USAGE_URL = 'https://api.github.com/copilot_internal/user';
/** Re-checked on every use: the pinned pattern, not the stored credential, decides
 * where a Copilot session token may be sent. */
export function copilotApiBase(credential: Pick<Credential, 'apiBase'>): string {
  return credential.apiBase && COPILOT_API_HOST.test(credential.apiBase)
    ? credential.apiBase
    : COPILOT_API;
}
export const copilotClientHeaders = (): Record<string, string> => ({
  'Copilot-Integration-Id': 'vscode-chat',
  'Editor-Version': COPILOT_EDITOR_VERSION,
  'Editor-Plugin-Version': COPILOT_PLUGIN_VERSION,
  'User-Agent': COPILOT_USER_AGENT,
  'X-GitHub-Api-Version': COPILOT_API_VERSION,
});
export const CLAUDE_USER_AGENT = 'claude-cli/2.1.220 (external, cli)';
/** Shared by model listing and inference: ChatGPT decides model visibility by it. */
export const CODEX_CLIENT_VERSION = '0.154.0';
export const CLAUDE_MODELS_URL = 'https://api.anthropic.com/v1/models';
export const CODEX_MODELS_URL = `https://chatgpt.com/backend-api/codex/models?client_version=${CODEX_CLIENT_VERSION}`;
export const ANTIGRAVITY_MODELS_URL =
  'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels';
// Deployment configuration is deliberately excluded from source control.
function clientConfig(vendor: SubscriptionVendor): {
  id: string;
  secret?: string;
} {
  const fixed = config[vendor].client;
  if (fixed) return { id: fixed };
  const prefix = vendor === 'antigravity' ? 'ANTIGRAVITY' : 'GEMINI';
  const id = process.env[`${prefix}_OAUTH_CLIENT_ID`]?.trim();
  const secret = process.env[`${prefix}_OAUTH_CLIENT_SECRET`]?.trim();
  if (
    !id ||
    !secret ||
    id.length > 2048 ||
    secret.length > 2048 ||
    /\s/.test(id) ||
    /\s/.test(secret)
  ) {
    throw new SubscriptionError(
      'configuration_required',
      503,
      `请在服务端配置 ${prefix}_OAUTH_CLIENT_ID 和 ${prefix}_OAUTH_CLIENT_SECRET 后重试`
    );
  }
  return { id, secret };
}
const caBase = 'https://cloudcode-pa.googleapis.com/v1internal';
const allowedUrls = new Set([
  ...Object.values(config).map((c) => c.token),
  'https://api.anthropic.com/api/oauth/profile',
  'https://api.anthropic.com/api/oauth/usage',
  'https://chatgpt.com/backend-api/wham/usage',
  'https://www.googleapis.com/oauth2/v2/userinfo',
  `${caBase}:loadCodeAssist`,
  `${caBase}:onboardUser`,
  `${caBase}:retrieveUserQuota`,
  'https://daily-cloudcode-pa.googleapis.com/v1internal:onboardUser',
  'https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary',
  config.copilot.device!.start,
  githubUserUrl,
  copilotSessionUrl,
  COPILOT_USAGE_URL,
  CODEX_MODELS_URL,
  ANTIGRAVITY_MODELS_URL,
]);
/** Targets that carry a value in the path or query; each pattern admits one fixed shape. */
const allowedPatterns = [
  /^https:\/\/cloudcode-pa\.googleapis\.com\/v1internal\/operations\/[A-Za-z0-9_-]+$/,
  /^https:\/\/api\.anthropic\.com\/v1\/models\?limit=1000(?:&after_id=[A-Za-z0-9._-]{1,128})?$/,
  /^https:\/\/api(?:\.(?:individual|business|enterprise))?\.githubcopilot\.com\/models$/,
];
const isAllowedTarget = (url: string) =>
  allowedUrls.has(url) || allowedPatterns.some((pattern) => pattern.test(url));
const failure = () =>
  new SubscriptionError('invalid_response', 502, '上游响应格式无效');

/** Fixed targets, no redirects, a 20-second deadline including body reads, and a body
 * cap of 1 MiB unless the caller raises it (model catalogs can be larger).
 * Statuses listed in `tolerated` are handed back to the caller instead of being mapped
 * to an error: device-code polling signals "still pending" with an HTTP status, which
 * requestJson cannot tell apart from a genuine refusal. */
async function sendJson(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch,
  signal: AbortSignal | undefined,
  tolerated: readonly number[],
  maxBytes = 1024 * 1024
): Promise<{ status: number; ok: boolean; body: Record<string, unknown> | null }> {
  if (!isAllowedTarget(url)) throw new SubscriptionError('invalid_target');
  if (signal?.aborted)
    throw new SubscriptionError('cancelled', 499, '操作已取消');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new SubscriptionError('retryable', 504, '上游请求超时，请重试'));
    }, 20_000);
    controller.signal.addEventListener(
      'abort',
      () =>
        reject(
          new SubscriptionError(
            signal?.aborted ? 'cancelled' : 'retryable',
            signal?.aborted ? 499 : 504,
            signal?.aborted ? '操作已取消' : '上游请求超时，请重试'
          )
        ),
      { once: true }
    );
  });
  try {
    return await Promise.race([
      deadline,
      (async () => {
        const response = await fetcher(url, {
          ...init,
          redirect: 'error',
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!tolerated.includes(response.status)) {
          if (response.status === 401) {
            void response.body?.cancel().catch(() => {});
            throw new SubscriptionError(
              'needs_reauth',
              401,
              '登录已失效，请重新登录'
            );
          }
          if (response.status === 429 || response.status >= 500) {
            void response.body?.cancel().catch(() => {});
            throw new SubscriptionError(
              'retryable',
              response.status,
              '上游暂时不可用，请稍后重试'
            );
          }
        }
        if (Number(response.headers.get('content-length')) > maxBytes) {
          void response.body?.cancel().catch(() => {});
          throw failure();
        }
        const reader = response.body?.getReader();
        if (!reader) throw failure();
        const cancelReader = () => {
          void reader.cancel().catch(() => {});
        };
        controller.signal.addEventListener('abort', cancelReader, {
          once: true,
        });
        if (controller.signal.aborted) cancelReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > maxBytes) {
              void reader.cancel().catch(() => {});
              throw failure();
            }
            chunks.push(chunk.value);
          }
        } finally {
          controller.signal.removeEventListener('abort', cancelReader);
          reader.releaseLock();
        }
        let body: Record<string, unknown> | null = null;
        try {
          const parsed: unknown = JSON.parse(
            Buffer.concat(chunks).toString('utf8')
          );
          if (
            parsed !== null &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed)
          )
            body = object(parsed);
        } catch {
          body = null;
        }
        return { status: response.status, ok: response.ok, body };
      })(),
    ]);
  } catch (error) {
    if (error instanceof SubscriptionError) throw error;
    throw new SubscriptionError(
      signal?.aborted ? 'cancelled' : 'retryable',
      signal?.aborted ? 499 : 502,
      signal?.aborted ? '操作已取消' : '上游网络请求失败，请重试'
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function requestJson(
  url: string,
  init: RequestInit = {},
  fetcher: typeof fetch = subscriptionFetch,
  signal?: AbortSignal,
  maxBytes?: number
): Promise<Record<string, unknown>> {
  const { status, ok, body } = await sendJson(
    url,
    init,
    fetcher,
    signal,
    [],
    maxBytes
  );
  if (!body)
    throw ok
      ? failure()
      : new SubscriptionError('upstream_rejected', status, '上游拒绝请求');
  if (!ok || body.error) {
    if (body.error === 'invalid_grant')
      throw new SubscriptionError('needs_reauth', 401, '登录已失效，请重新登录');
    throw new SubscriptionError(
      'upstream_rejected',
      ok ? 502 : status,
      '上游拒绝请求'
    );
  }
  return body;
}

/** Device-code polling only: the listed statuses come back unmapped so the caller can
 * tell "the user has not approved yet" apart from "the upstream refused". */
export async function requestJsonStatus(
  url: string,
  init: RequestInit,
  tolerated: readonly number[],
  fetcher: typeof fetch = subscriptionFetch,
  signal?: AbortSignal
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const { status, body } = await sendJson(url, init, fetcher, signal, tolerated);
  return { status, body };
}

export function createAuthorization(vendor: SubscriptionVendor): Authorization {
  const c = config[vendor];
  // Device-only vendors have no authorize URL; they must use createDeviceAuthorization.
  if (!c?.authorize) throw new SubscriptionError('invalid_vendor');
  const verifier = randomBytes(48).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const url = new URL(c.authorize);
  const query: Record<string, string> = {
    response_type: 'code',
    client_id: clientConfig(vendor).id,
    redirect_uri: c.redirect,
    scope: c.scope,
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  };
  if (vendor === 'claude') query.code = 'true';
  if (vendor === 'codex')
    Object.assign(query, {
      prompt: 'login',
      id_token_add_organizations: 'true',
      codex_cli_simplified_flow: 'true',
      originator: 'codex_cli_rs',
    });
  if (vendor === 'gemini' || vendor === 'antigravity')
    Object.assign(query, { access_type: 'offline', prompt: 'consent' });
  if (vendor === 'antigravity') {
    delete query.code_challenge;
    delete query.code_challenge_method;
  }
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return {
    vendor,
    kind: 'paste',
    url: url.toString(),
    state,
    verifier,
    redirectUri: c.redirect,
  };
}
function validateAuth(auth: Authorization) {
  // A device authorization carries no redirect or browser-bound state to check, and
  // must never reach the paste path.
  if (auth.kind === 'device')
    throw new SubscriptionError('invalid_authorization');
  if (
    !config[auth.vendor] ||
    auth.redirectUri !== config[auth.vendor].redirect ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(auth.verifier) ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(auth.state)
  )
    throw new SubscriptionError('invalid_authorization');
}
export function parseAuthorizationCode(
  auth: Authorization,
  input: string
): string {
  validateAuth(auth);
  if (typeof input !== 'string' || input.length > 16_384)
    throw new SubscriptionError('invalid_callback');
  input = input.trim();
  if (auth.vendor === 'gemini' && !input.includes('://')) {
    if (!/^[A-Za-z0-9_./~-]{1,4096}$/.test(input))
      throw new SubscriptionError('invalid_code');
    return input;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SubscriptionError('invalid_callback');
  }
  if (
    url.origin + url.pathname !== auth.redirectUri ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new SubscriptionError('invalid_callback');
  const states = url.searchParams.getAll('state');
  if (
    states.length !== 1 ||
    Buffer.byteLength(states[0]) !== Buffer.byteLength(auth.state) ||
    !timingSafeEqual(Buffer.from(states[0]), Buffer.from(auth.state))
  )
    throw new SubscriptionError('invalid_state');
  if (url.searchParams.has('error'))
    throw new SubscriptionError('authorization_denied', 400, '授权未完成');
  const codes = url.searchParams.getAll('code');
  if (codes.length !== 1 || !safeString(codes[0], 4096) || /\s/.test(codes[0]))
    throw new SubscriptionError('invalid_code');
  return codes[0];
}
function tokenFields(body: Record<string, unknown>, old?: Credential) {
  const accessToken = safeString(body.access_token, 32_768);
  const refreshToken =
    body.refresh_token === undefined
      ? old?.refreshToken
      : safeString(body.refresh_token, 32_768);
  if (
    !accessToken ||
    !refreshToken ||
    /\s/.test(accessToken) ||
    /\s/.test(refreshToken) ||
    typeof body.expires_in !== 'number' ||
    !Number.isFinite(body.expires_in) ||
    body.expires_in <= 0 ||
    body.expires_in > 31_536_000
  )
    throw failure();
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
}
async function tokenRequest(
  vendor: SubscriptionVendor,
  fields: Record<string, string>,
  fetcher: typeof fetch,
  signal?: AbortSignal
) {
  const c = config[vendor];
  if (!c) throw new SubscriptionError('invalid_vendor');
  const client = clientConfig(vendor);
  fields.client_id = client.id;
  if (client.secret) fields.client_secret = client.secret;
  return requestJson(
    c.token,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          vendor === 'claude'
            ? 'application/json'
            : 'application/x-www-form-urlencoded',
      },
      body:
        vendor === 'claude'
          ? JSON.stringify(fields)
          : new URLSearchParams(fields).toString(),
    },
    fetcher,
    signal
  );
}
function decodedExchangeIdentity(value: unknown) {
  // This is a claim reader ONLY for tokens returned over the fixed official TLS token endpoint.
  // It is never used to authenticate a caller-supplied JWT or imported token.
  if (typeof value !== 'string' || value.length > 65_536) return {};
  try {
    const parts = value.split('.');
    if (parts.length !== 3) return {};
    return object(
      JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    );
  } catch {
    return {};
  }
}
function validProject(value: unknown): string | null {
  const s = safeString(value);
  return s && /^[a-z][a-z0-9-]{4,62}[a-z0-9]$/.test(s) ? s : null;
}
function googleProjectUnavailable(
  load: Record<string, unknown>
): SubscriptionError {
  const reasons = Array.isArray(load.ineligibleTiers)
    ? load.ineligibleTiers
    : [];
  if (reasons.length) {
    const descriptions: Record<string, string> = {
      DASHER_USER: 'Google 将该账号识别为组织账号',
      INELIGIBLE_ACCOUNT: '账号不符合个人版使用条件',
      NON_USER_ACCOUNT: '该账号不是个人用户账号',
      RESTRICTED_AGE: '账号年龄不符合使用条件',
      RESTRICTED_NETWORK: '当前网络受到限制',
      UNKNOWN_LOCATION: 'Google 无法确定当前地区',
      UNSUPPORTED_LOCATION: '当前地区不受支持',
      VALIDATION_REQUIRED: '账号需要额外验证',
    };
    const details = reasons.slice(0, 5).map((item) => {
      const reason = object(item);
      const code = safeString(reason.reasonCode, 64);
      const label = code && /^[A-Z_]+$/.test(code) ? code : 'UNKNOWN';
      const message =
        descriptions[label] ??
        safeString(reason.reasonMessage, 512) ??
        'Google 未说明具体原因';
      return `${message}（${label}）`;
    });
    return new SubscriptionError(
      'ineligible_account',
      403,
      `Google 未提供可用的 Gemini 项目：${details.join('；')}`
    );
  }
  return new SubscriptionError(
    'project_required',
    400,
    'Google 未返回可用的项目 ID。若账号使用组织或 Code Assist 许可证，请填写对应 Google Cloud 项目 ID 后重新授权；个人账号请先确认已开通 Gemini Code Assist'
  );
}
async function googleProject(
  accessToken: string,
  supplied: string | undefined,
  fetcher: typeof fetch,
  signal?: AbortSignal
) {
  if (supplied && !validProject(supplied))
    throw new SubscriptionError(
      'invalid_project',
      400,
      '请输入有效的 Google Cloud 项目 ID（非数字项目编号）'
    );
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const metadata = {
    ideType: 'IDE_UNSPECIFIED',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI',
  };
  const load = await requestJson(
    `${caBase}:loadCodeAssist`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cloudaicompanionProject: supplied,
        metadata: { ...metadata, duetProject: supplied },
      }),
    },
    fetcher,
    signal
  );
  const current = object(load.currentTier);
  const paid = object(load.paidTier);
  if (!load.currentTier && Array.isArray(load.ineligibleTiers)) {
    for (const item of load.ineligibleTiers) {
      const tier = object(item);
      if (tier.reasonCode !== 'VALIDATION_REQUIRED') continue;
      let link = '';
      try {
        const u = new URL(String(tier.validationUrl));
        if (
          u.protocol === 'https:' &&
          !u.username &&
          !u.password &&
          !u.port &&
          ['accounts.google.com', 'myaccount.google.com'].includes(
            u.hostname
          ) &&
          u.toString().length < 2048
        )
          link = u.toString();
      } catch {
        /* omit untrusted URL */
      }
      throw new SubscriptionError(
        'validation_required',
        403,
        `Google 要求额外账号验证${link ? `：${link}` : '，请在 Google 账号页面完成验证'}`
      );
    }
  }
  const projectRequired = () => googleProjectUnavailable(load);
  if (load.currentTier) {
    const projectId = validProject(load.cloudaicompanionProject) ?? supplied;
    if (!projectId) throw projectRequired();
    return {
      projectId,
      plan:
        safeString(paid.name) ??
        safeString(current.name) ??
        safeString(paid.id) ??
        safeString(current.id),
    };
  }
  const tiers = Array.isArray(load.allowedTiers)
    ? load.allowedTiers.map(object)
    : [];
  const tier = tiers.find((t) => t.isDefault === true) ?? { id: 'legacy-tier' };
  const tierId = safeString(tier.id);
  if (!tierId) throw failure();
  // Match Gemini CLI: allow the selected tier's onboarding to resolve a project
  // before deciding that a manually supplied project is required.
  let operation = await requestJson(
    `${caBase}:onboardUser`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tierId,
        ...(tierId === 'free-tier'
          ? {}
          : { cloudaicompanionProject: supplied }),
        metadata: {
          ...metadata,
          ...(tierId === 'free-tier' ? {} : { duetProject: supplied }),
        },
      }),
    },
    fetcher,
    signal
  );
  const name = safeString(operation.name);
  const end = Date.now() + 60_000;
  while (operation.done !== true) {
    if (!name || !/^operations\/[A-Za-z0-9_-]+$/.test(name)) throw failure();
    if (Date.now() >= end)
      throw new SubscriptionError(
        'retryable',
        504,
        'Google 项目初始化超时，请稍后重试'
      );
    try {
      await delay(1000, undefined, { signal });
    } catch {
      throw new SubscriptionError('cancelled', 499, '操作已取消');
    }
    operation = await requestJson(
      `${caBase}/${name}`,
      { headers },
      fetcher,
      signal
    );
  }
  const projectId =
    validProject(
      object(object(operation.response).cloudaicompanionProject).id
    ) ?? supplied;
  if (!projectId) throw projectRequired();
  return { projectId, plan: safeString(tier.name) ?? tierId };
}

/** Antigravity contract from CLIProxyAPI 7fa443dc, distinct from Gemini CLI. */
async function antigravityProject(
  accessToken: string,
  fetcher: typeof fetch,
  signal?: AbortSignal
) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'User-Agent': ANTIGRAVITY_USER_AGENT,
    Accept: '*/*',
  };
  const project = (value: unknown): string | null => {
    const data = object(value);
    for (const key of ['cloudaicompanionProject', 'projectId', 'project']) {
      const v =
        typeof data[key] === 'string' ? data[key] : object(data[key]).id;
      const id = safeString(v);
      if (id && /^[a-zA-Z0-9._:-]+$/.test(id)) return id;
    }
    return null;
  };
  const load = await requestJson(
    `${caBase}:loadCodeAssist`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } }),
    },
    fetcher,
    signal
  );
  const plan =
    safeString(object(load.paidTier).name) ??
    safeString(object(load.currentTier).name) ??
    safeString(object(load.currentTier).id);
  const found = project(load);
  if (found) return { projectId: found, plan };
  // ineligibleTiers describes individual tiers, not the whole account.
  // Let Antigravity onboarding decide eligibility for the selected/default tier.
  const tiers = Array.isArray(load.allowedTiers)
    ? load.allowedTiers.map(object)
    : [];
  const tierId =
    safeString(tiers.find((t) => t.isDefault === true)?.id) ??
    safeString(object(load.currentTier).id) ??
    'free-tier';
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) {
      try {
        await delay(1000, undefined, { signal });
      } catch {
        throw new SubscriptionError('cancelled', 499, '操作已取消');
      }
    }
    const result = await requestJson(
      'https://daily-cloudcode-pa.googleapis.com/v1internal:onboardUser',
      {
        method: 'POST',
        headers: {
          ...headers,
          'User-Agent': `${ANTIGRAVITY_USER_AGENT} google-api-nodejs-client/10.3.0`,
          'X-Goog-Api-Client': 'gl-node/22.21.1',
        },
        body: JSON.stringify({
          tier_id: tierId,
          metadata: {
            ide_type: 'ANTIGRAVITY',
            ide_version: ANTIGRAVITY_VERSION,
            ide_name: 'antigravity',
          },
        }),
      },
      fetcher,
      signal
    );
    if (result.done === true) {
      const projectId = project(result.response);
      if (!projectId)
        throw new SubscriptionError(
          'project_required',
          502,
          'Antigravity 未返回托管项目，请确认账号已开通反重力'
        );
      return { projectId, plan: plan ?? tierId };
    }
  }
  throw new SubscriptionError(
    'retryable',
    504,
    'Antigravity 项目初始化超时，请重新授权'
  );
}

export async function exchangeAuthorization(
  auth: Authorization,
  code: string,
  projectId?: string,
  fetcher: typeof fetch = subscriptionFetch,
  signal?: AbortSignal
): Promise<Credential> {
  validateAuth(auth);
  if (!safeString(code, 4096) || /\s/.test(code))
    throw new SubscriptionError('invalid_code');
  const body = await tokenRequest(
    auth.vendor,
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: auth.redirectUri,
      ...(auth.vendor === 'antigravity'
        ? {}
        : { code_verifier: auth.verifier }),
      ...(auth.vendor === 'claude' ? { state: auth.state } : {}),
    },
    fetcher,
    signal
  );
  const fields = tokenFields(body);
  if (auth.vendor === 'codex') {
    const claims = decodedExchangeIdentity(body.id_token);
    const identity = object(claims['https://api.openai.com/auth']);
    const accountKey = safeString(identity.chatgpt_account_id);
    if (!accountKey)
      throw new SubscriptionError(
        'invalid_identity',
        502,
        '上游未返回可验证的账号身份'
      );
    return {
      ...fields,
      accountKey,
      email: safeString(claims.email),
      plan: safeString(identity.chatgpt_plan_type),
    };
  }
  if (auth.vendor === 'claude') {
    let profile = body;
    try {
      profile = await requestJson(
        'https://api.anthropic.com/api/oauth/profile',
        {
          headers: {
            Authorization: `Bearer ${fields.accessToken}`,
            'anthropic-beta': 'oauth-2025-04-20',
          },
        },
        fetcher,
        signal
      );
    } catch (e) {
      if (
        !safeString(object(body.account).uuid) ||
        (e instanceof SubscriptionError && e.code === 'cancelled')
      )
        throw e;
    }
    const accountKey =
      safeString(object(profile.account).uuid) ??
      safeString(object(body.account).uuid);
    if (!accountKey)
      throw new SubscriptionError(
        'invalid_identity',
        502,
        '上游未返回可验证的账号身份'
      );
    return {
      ...fields,
      accountKey,
      email:
        safeString(object(profile.account).email) ??
        safeString(object(body.account).email_address),
      organizationId:
        safeString(object(profile.organization).uuid) ??
        safeString(object(body.organization).uuid),
    };
  }
  const user = await requestJson(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    { headers: { Authorization: `Bearer ${fields.accessToken}` } },
    fetcher,
    signal
  );
  const accountKey = safeString(user.id);
  if (!accountKey)
    throw new SubscriptionError(
      'invalid_identity',
      502,
      '上游未返回可验证的账号身份'
    );
  return {
    ...fields,
    accountKey,
    email: safeString(user.email),
    ...(await (auth.vendor === 'antigravity'
      ? antigravityProject(fields.accessToken, fetcher, signal)
      : googleProject(fields.accessToken, projectId, fetcher, signal))),
  };
}
export async function refreshCredential(
  vendor: SubscriptionVendor,
  credential: Credential,
  fetcher: typeof fetch = subscriptionFetch,
  signal?: AbortSignal
): Promise<Credential> {
  if (
    !safeString(credential.refreshToken, 32_768) ||
    /\s/.test(credential.refreshToken)
  )
    throw new SubscriptionError('needs_reauth', 401, '登录已失效，请重新登录');
  // Copilot's long-lived credential is the GitHub user token; "refreshing" means
  // trading it for a new short-lived Copilot session token.
  if (vendor === 'copilot')
    return {
      ...credential,
      ...(await copilotSession(credential.refreshToken, fetcher, signal)),
    };
  const body = await tokenRequest(
    vendor,
    {
      grant_type: 'refresh_token',
      refresh_token: credential.refreshToken,
      ...(vendor === 'claude'
        ? { scope: config.claude.scope }
        : vendor === 'codex'
          ? { scope: 'openid profile email' }
          : {}),
    },
    fetcher,
    signal
  );
  return { ...credential, ...tokenFields(body, credential) };
}

/* ---------------------------------------------------------------------------
 * GitHub Copilot: device-code login and the two-token credential model.
 *
 * GitHub issues a long-lived user token (ghu_…); Copilot inference needs a
 * short-lived session token traded for it. They map onto Credential as
 * refreshToken = ghu_…, accessToken = session token, so the existing lifecycle
 * (refresh 60s early, retry once on 401, DB lease, version CAS) works unchanged.
 * ------------------------------------------------------------------------- */

const clampInterval = (value: unknown, fallback = 5): number => {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Math.min(60, Math.max(3, Number.isFinite(n) && n > 0 ? n : fallback)) * 1000;
};

const githubHeaders = (ghuToken: string): Record<string, string> => ({
  Authorization: `token ${ghuToken}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': COPILOT_USER_AGENT,
});

/** Trades the GitHub user token for a Copilot session token and records which
 * inference host serves this seat. */
async function copilotSession(
  ghuToken: string,
  fetcher: typeof fetch = subscriptionFetch,
  signal?: AbortSignal
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  apiBase: string;
}> {
  // A 403 means the GitHub login is fine but the account has no Copilot seat, which
  // deserves its own message rather than a generic refusal.
  const { status, body } = await requestJsonStatus(
    copilotSessionUrl,
    {
      headers: {
        ...githubHeaders(ghuToken),
        'Editor-Version': COPILOT_EDITOR_VERSION,
        'Editor-Plugin-Version': COPILOT_PLUGIN_VERSION,
      },
    },
    [403],
    fetcher,
    signal
  );
  if (status === 403)
    throw new SubscriptionError(
      'no_subscription',
      403,
      '该 GitHub 账号没有可用的 Copilot 订阅'
    );
  if (!body || status < 200 || status >= 300 || body.error)
    throw new SubscriptionError(
      'upstream_rejected',
      status >= 400 ? status : 502,
      '上游拒绝请求'
    );
  const accessToken = safeString(body.token, 32_768);
  const seconds = body.expires_at;
  const expiresAt = typeof seconds === 'number' ? seconds * 1000 : NaN;
  if (
    !accessToken ||
    /\s/.test(accessToken) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() ||
    expiresAt > Date.now() + 86_400_000
  )
    throw failure();
  // Individual, business and enterprise seats are served from different hosts. Only
  // the pinned githubcopilot.com shapes are followed; anything else is refused.
  const api =
    safeString(object(body.endpoints).api, 512)?.replace(/\/+$/, '') ?? null;
  if (api && !COPILOT_API_HOST.test(api))
    throw new SubscriptionError(
      'unsupported_account',
      400,
      'GitHub Copilot 返回了未支持的推理端点（如 GitHub Enterprise Server），当前仅支持 github.com 账号'
    );
  return {
    accessToken,
    refreshToken: ghuToken,
    expiresAt,
    apiBase: api ?? COPILOT_API,
  };
}

async function copilotCredential(
  ghuToken: string,
  fetcher: typeof fetch = subscriptionFetch,
  signal?: AbortSignal
): Promise<Credential> {
  const user = await requestJson(
    githubUserUrl,
    { headers: githubHeaders(ghuToken) },
    fetcher,
    signal
  );
  const accountKey =
    typeof user.id === 'number' && Number.isSafeInteger(user.id)
      ? String(user.id)
      : safeString(user.id);
  if (!accountKey)
    throw new SubscriptionError(
      'invalid_identity',
      502,
      '上游未返回可验证的账号身份'
    );
  return {
    ...(await copilotSession(ghuToken, fetcher, signal)),
    accountKey,
    email: safeString(user.email) ?? safeString(user.login),
  };
}

/** Starts a device-code login. Unlike createAuthorization this needs the network. */
export async function createDeviceAuthorization(
  vendor: SubscriptionVendor,
  fetcher: typeof fetch = subscriptionFetch,
  signal?: AbortSignal
): Promise<Authorization> {
  const device = config[vendor]?.device;
  if (!device) throw new SubscriptionError('invalid_vendor');
  const body = await requestJson(
    device.start,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientConfig(vendor).id,
        scope: config[vendor].scope,
      }),
    },
    fetcher,
    signal
  );
  const handle = safeString(body.device_code, 4096);
  const userCode = safeString(body.user_code, 64);
  if (!handle || !userCode || /\s/.test(handle)) throw failure();
  const expires = typeof body.expires_in === 'number' ? body.expires_in : 900;
  return {
    vendor,
    kind: 'device',
    // Deliberately the pinned constant: never navigate the operator's browser to a
    // URL chosen by the upstream response.
    url: device.verification,
    state: randomBytes(32).toString('base64url'),
    verifier: randomBytes(48).toString('base64url'),
    redirectUri: config[vendor].redirect,
    device: {
      handle,
      userCode,
      intervalMs: clampInterval(body.interval),
      expiresAt: Date.now() + Math.min(Math.max(expires, 60), 900) * 1000,
    },
  };
}

export type DevicePoll =
  | { status: 'pending'; retryAfterMs: number }
  | { status: 'complete'; credential: Credential };

/** One upstream poll. The 15-minute wait belongs to the browser, not this request. */
export async function pollDeviceAuthorization(
  auth: Authorization,
  fetcher: typeof fetch = subscriptionFetch,
  signal?: AbortSignal
): Promise<DevicePoll> {
  const device = config[auth.vendor]?.device;
  if (auth.kind !== 'device' || !auth.device || !device)
    throw new SubscriptionError('invalid_authorization');
  if (Date.now() >= auth.device.expiresAt)
    throw new SubscriptionError('device_expired', 410, '设备码已过期，请重新发起登录');
  // GitHub reports "not approved yet" as HTTP 200 with an error field, so the status
  // must come back unmapped for the pending case to be distinguishable.
  const { body } = await requestJsonStatus(
    device.poll,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientConfig(auth.vendor).id,
        device_code: auth.device.handle,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    },
    [200],
    fetcher,
    signal
  );
  if (!body) throw failure();
  const error = safeString(body.error, 128);
  if (error === 'authorization_pending')
    return { status: 'pending', retryAfterMs: auth.device.intervalMs };
  if (error === 'slow_down')
    return {
      status: 'pending',
      retryAfterMs: Math.min(auth.device.intervalMs + 5000, 60_000),
    };
  if (error === 'expired_token')
    throw new SubscriptionError('device_expired', 410, '设备码已过期，请重新发起登录');
  if (error === 'access_denied')
    throw new SubscriptionError('authorization_denied', 400, '授权已被拒绝');
  if (error)
    throw new SubscriptionError('upstream_rejected', 502, '上游拒绝请求');
  const ghuToken = safeString(body.access_token, 32_768);
  if (!ghuToken || /\s/.test(ghuToken)) throw failure();
  return {
    status: 'complete',
    credential: await copilotCredential(ghuToken, fetcher, signal),
  };
}
