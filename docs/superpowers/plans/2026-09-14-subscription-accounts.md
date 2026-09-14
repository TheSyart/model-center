# Subscription accounts implementation plan

**Goal:** 原生实现 Claude Code、Codex、Gemini OAuth、多账号额度与网关调用。
**Spec:** ../specs/2026-09-14-subscription-accounts-design.md
**Architecture:** 独立订阅领域模块，SQLite 加密凭据，现有网关协议转换和账号级 provider 路由。所有控制面 HTTP 固定官方目标，浏览器仅获脱敏结果。
**Tech stack:** Next.js 15 / TypeScript / better-sqlite3 / existing Radix components.

## Global constraints
- 禁止编辑 CC Switch 生成文件；保留现有用户数据与未提交素材。
- MASTER_KEY 不变，OAuth secret 不进入 API、日志、普通导出。
- Gemini 使用 Google 官方授权码粘贴，Claude/Codex 使用完整回调 URL + PKCE/state。
- 不增加真实额度，不消费重置券，不自动购买，不擅自导入本机 CLI 凭据。
- 所有账号独立，未知额度 null，错误保留成功快照，不虚构真实联调成功。

## Tasks

### Task 1: Auth and quota contracts
Files: lib/subscriptions/types.ts, oauth.ts, quota.ts, tests/subscription-oauth.test.ts, subscription-quota.test.ts.
Interface: createAuthorization(vendor) -> Authorization; exchangeAuthorization(auth, code, projectId?, fetcher?) -> Credential; refreshCredential(vendor, credential, fetcher?) -> Credential; fetchQuota(vendor, credential, fetcher?) -> QuotaSnapshot.
- [x] Write failing boundary tests: PKCE, URL allowlist/state, token exchange, refresh rotation, invalid grant, missing identity, Gemini project onboarding, timeout; Claude/Codex/Gemini quotas, explicit zero, missing and malformed values, multiple windows, reset times, failed response.
- [x] Run node --experimental-strip-types --test tests/subscription-{oauth,quota}.test.ts and confirm RED.
- [x] Implement network boundary using fixed source contracts, strict error sanitization, bounded fetch and JSON validation.
- [x] Confirm GREEN. Independent review of auth and quota files before final integration.

### Task 2: Persistence and lifecycle
Files: lib/subscriptions/store.ts, runtime.ts, lib/db/index.ts, tests/subscription-store.test.ts.
Interface: createSubscriptionStore(sqlite, encrypt, decrypt) -> account/session/snapshot/provider-link operations. Credential envelope is separate from public AccountView.
- [x] Test real in-memory SQLite migration idempotence, old provider preservation, encryption, duplicate identity, session expiry/owner/replay, atomic refresh lease/version, failed refresh preservation, delete/link protection.
- [x] Confirm RED then implement transactional store; no OAuth token masquerading as API key.
- [x] Runtime performs refresh single-flight and database lease, bounded retries and retains previous successful quota.
- [x] Confirm GREEN and integrate migration after existing migrations.

### Task 3: Subscription gateway
Files: lib/subscriptions/gateway.ts, lib/gateway/pipeline.ts, logger.ts, tests/subscription-gateway.test.ts.
Interface: subscriptionWireRequest(vendor, credential, request, model, stream, anthropicBeta?) updates official URL, auth and envelope; normalizeSubscriptionResponse handles Gemini envelope and Codex SSE aggregation.
- [x] Tests for Claude Bearer vs API key, preserving native tool fields, Codex headers/store/stream, terminal/error/partial SSE, Gemini request/response wrappers, fragmented CRLF SSE, cancellation, no switching after emitted bytes.
- [x] Confirm RED then implement fixed target requests and response normalization.
- [x] Integrate before fetchUpstream, refresh once after 401, map disabled/relogin/temporary errors into alias failover, subscription log cost null.
- [x] Confirm GREEN. Existing API-key path must remain behaviorally identical.

### Task 4: Management API and UI
Files: app/api/admin/subscriptions/**, app/(admin)/subscriptions/**, components/nav.tsx, provider admin protections, tests/subscription-admin.test.ts, tests/ui/subscriptions.test.tsx.
API: GET list; POST oauth; POST oauth/complete; PATCH/DELETE account; POST quota; POST gateway with explicit model IDs. Sessions use HttpOnly owner cookies and same-origin mutation checks. All responses no-store.
- [x] Test bad input, cross-origin, wrong owner, replay, secret omission, expired authorization, enable/disable, linked deletion and model validation.
- [x] Confirm RED then add routes and UI with working login, cancel, retry, quota, gateway association and disconnect controls.
- [x] Render empty/loading/error/connected states using existing design tokens. Credentials never enter React props.
- [x] Browser verify desktop/mobile plus component tests.

### Task 5: Release verification
- [x] npm test; npm run typecheck; npm run build; fixed-SHA sync --check; git diff --check.
- [x] Browser smoke and mock upstream end-to-end for three providers, both streaming and non-streaming.
- [x] Independent code review and fixes; record actual results in docs/subscription-accounts.md.
- [ ] Real OAuth and quota/call acceptance requires user's browser authorization; preserve separate not-yet-verified status until observed.

## Progress / decisions
Task 1–4 已实现。Task 5 自动化、构建、浏览器验收已执行；独立审查问题已修复，最终全量测试 308 core / 63 UI-runtime / 6 browser 通过。真实授权与推理留待用户在官方页面登录后验收。
Ruling: 使用当前目录的新功能分支，避免移动用户已有未提交素材；不提交或合并用户无关文件。
Ruling: 新增 subscription_provider_links 关系表代替在 providers 上新增可空列，保持现有 schema/配置导出的兼容性；关联查询按 provider ID，等价于设计的外键关系。
Ruling: 首版模型采用用户显式输入，不通过公共模型目录猜测订阅权益；每个账号可配置多个模型并走现有别名管理。


Review fixes: account scope identity; refresh lease credential race; quota snapshot CAS; subscription/API-key protection; legacy alias import binding; Claude capability beta forwarding; Next Host origin; explicit HTTPS public origin; hide API prices for subscription models; native Codex data-only SSE usage accounting. Evidence counts and limits are maintained in docs/subscription-accounts.md. Browser quota displays use fixtures, not real account quotas.

Google OAuth 客户端配置由 GEMINI_OAUTH_CLIENT_ID / GEMINI_OAUTH_CLIENT_SECRET 注入，未配置时返回明确 503；避免将部署配置提交到 Git。
