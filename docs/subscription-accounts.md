# 订阅账号：登录、额度与网关

新增管理入口 `/subscriptions`，原生集成到 Model Center 的 Next.js 服务中，无需部署 CLIProxyAPI sidecar。当前登录入口为 Claude Code、Codex、Antigravity CLI（反重力）和 GitHub Copilot。前三家参考固定版本 CLIProxyAPI 的独立授权和请求执行协议，GitHub Copilot 参考固定版本 cc-switch 的设备码登录与模型接口；**没有执行真实账号的登录、额度查询、模型拉取或推理验收**。

## 使用

1. 启动现有 Model Center，进入侧栏 **订阅账号**。沿用当前 `MASTER_KEY` 和数据库目录。Antigravity 登录需要在服务端配置 `ANTIGRAVITY_OAUTH_CLIENT_ID` 和 `ANTIGRAVITY_OAUTH_CLIENT_SECRET`，使用 Antigravity 独立客户端，不能复用 Gemini CLI 的 OAuth 客户端；配置值不随 Git 分发，缺失时显示明确错误。Claude/Codex 不需要这两个变量。
2. 授权登录厂商集中在订阅页，Claude/Codex/GitHub Copilot 复用服务商目录图标，Antigravity 使用独立官方图标。**xAI (Grok)** 保留“尚未开放”占位，不发起未实现的登录；API Key 服务商选择器不再展示 OAuth-only 预设。选择 **登录 Claude Code / Codex / Antigravity CLI**，生成链接后打开官方授权页；选择 **登录 GitHub Copilot**，点击 **获取设备码**。
3. Claude/Codex/Antigravity 授权后，复制浏览器地址栏的完整本地回调 URL。页面显示 localhost 无法访问不影响复制；本应用使用手动粘贴回调，无需开启回调监听端口。Antigravity 的回调为 `http://localhost:51121/oauth-callback`，必须粘贴含 code 和 state 的完整地址，不接受裸授权码。返回 Model Center，粘贴并完成登录。GitHub Copilot 不使用回调：在 GitHub 验证页（`https://github.com/login/device`，固定地址，不跟随上游返回值）输入页面显示的设备码并授权，本页按服务端节奏自动轮询完成登录，无需粘贴；该 GitHub 账号没有 Copilot 订阅时会明确提示。
4. Antigravity 通过 `ANTIGRAVITY` 元数据发现托管项目，缺少项目时执行有界初始化，无需手工填写 Gemini CLI 的 Google Cloud 项目 ID。账号资格仍由 Google 决定。登录与额度查询分别处理，额度查询失败不会删除有效登录。
5. 点击 **刷新额度** 或 **刷新全部额度** 获取厂商数据。页面每 60 秒读取本地快照；官方额度仅在登录后或手动刷新时查询，避免打开多个页面重复请求上游。
6. 登录成功后，系统用该账号的凭据请求厂商官方模型接口（见下方“模型来源”），把返回的全部模型接入网关，并生成独立服务商 slug，例如 `oauth-codex-12345678`。之后点击 **同步模型** 可重新拉取：只新增模型，不删除已有模型，也不改变启停状态；上游不再列出的已同步模型只计数。拉取失败时保留登录并在账号卡片显示原因，可点击 **接入网关** 手动填写模型 ID（每行一个）。不会把公共 API 模型目录当作订阅权限证明，没有内置静态模型表，也不会消费推理额度来试探权限。
7. 使用现有网关令牌调用 `slug/模型ID`，或到 **别名** 页面配置多个账号的有序回退。模型可在服务商的模型面板中启停、添加和删除。

调用示例（替换三个占位值）：

```sh
curl http://localhost:3000/v1/chat/completions \
  -H 'Authorization: Bearer YOUR_GATEWAY_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"model":"YOUR_PROVIDER_SLUG/YOUR_MODEL_ID","messages":[{"role":"user","content":"你好"}],"stream":false}'
```

现有 `/v1/chat/completions`、`/v1/messages`、`/v1/responses` 入口均复用原网关转换能力。Gemini 是上游协议，未增加对外 Gemini 原生路由。Codex 上游使用 Responses SSE，即使客户端要求 JSON，也由服务端收集终止事件再转换返回；Antigravity 使用 daily Cloud Code 接口和独立的 project/model/requestType/requestId/request 包装；响应解包后复用 Gemini 协议转换。

## 模型来源

| 厂商 | 官方模型接口 | 过滤规则 |
|---|---|---|
| GitHub Copilot | `GET {座席推理域名}/models`，Copilot 会话令牌加 VS Code Copilot Chat 客户端请求头 | 丢弃 `policy.state` 不是 enabled、`model_picker_enabled=false`、非 chat 类型和 embedding 模型；按 `supported_endpoints` 区分 `/chat/completions` 与 `/responses` |
| Codex | `GET chatgpt.com/backend-api/codex/models?client_version=0.154.0` | 只保留 `visibility=list`，且 `minimal_client_version` 不高于发送版本；推理请求使用同一版本号 |
| Claude Code | `GET api.anthropic.com/v1/models`，OAuth Bearer 加 `oauth-2025-04-20`，按 `after_id` 翻页 | 全部保留。**只有第三方实现佐证，待真实账号验收** |
| Antigravity | `POST daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`，携带托管项目 | 丢弃 `isInternal`、内部占位 ID 以及图像、音频、向量、视频模型 |

模型 ID 仍须通过网关模型 ID 校验，单次最多接入 500 个。模型接口响应上限为 8 MiB，其他控制面请求仍为 1 MiB。

GitHub Copilot 的推理域名取自令牌交换返回的 `endpoints.api`，只接受 `api.githubcopilot.com` 及其 individual/business/enterprise 子域；返回其他域名（如 GitHub Enterprise Server）时拒绝登录。每次使用前都会重新校验域名。

Copilot 服务商同时建立 Chat（默认）与 Responses 两个协议端点，各自维护完整的模型目录。只支持 `/responses` 的模型从 `/v1/chat/completions` 或 `/v1/messages` 调用时，会先转换再发往 `/responses`，反方向同理。手动添加到 Copilot 服务商的模型进入 Chat 端点目录。其余三家保持单端点，目录不标记为完整，手动添加的模型不受影响。

同优先级时，裸模型名路由改为优先匹配先创建的服务商，所以自动同步进来的订阅模型不会抢占已有 API Key 服务商的同名模型。需要让订阅账号优先时，调整服务商优先级或使用别名。

## 额度、账号与故障

- Antigravity 使用 `retrieveUserQuotaSummary`，保留 Gemini、Claude/GPT 等上游额度分组及 5 小时/周窗口，分组之间不相加。
- 额度以**账号、模型和时间窗口**展示。`0%` 是确实耗尽；缺少数值显示“未知”，不当作零或无限额。不同账号没有可以相加的统一余额。
- 查询失败保留上次成功快照并提示过时，显示重置时间与上次更新时间。不会自动重置额度、购买额度或兑换任何重置券。
- 每个账号的凭据独立刷新。到期前 60 秒或上游首次返回 401 时尝试刷新；同进程合并并发刷新，跨进程使用数据库租约及版本校验，避免刷新令牌重复消费或旧请求覆盖重新登录结果。
- 别名继续使用项目原有的回退策略：上游 429、网络失败或 5xx 可尝试下一目标。流式响应已开始输出后不自动切换账号。没有根据可能过时的额度快照提前跳过账号。
- 请求日志保留 token 用量，但订阅调用 `cost=null`，不会把 API 定价冒充套餐账单。因此现有**金额限额不限制订阅 token 消耗**；需要停止调用时禁用账号、模型或网关令牌。
- 禁用账号同步禁用关联服务商。删除账号前先断开网关；若别名仍引用关联服务商，需先移除引用。
- 普通 JSON 导出不含订阅授权、关联服务商和模型；混合别名仅保留 API Key 目标的原顺序，纯订阅别名不导出。文件内 `export_warnings` 记录排除情况。完整实例备份仍应保留数据库和原 `MASTER_KEY`，不要更换密钥后期待旧凭据自动恢复。

## 实现与维护

核心文件：

- `lib/subscriptions/oauth.ts`：Claude/Codex PKCE、GitHub Copilot 设备码与会话令牌交换、所有客户端的 state、代码交换、刷新、Google 项目初始化和控制面目标白名单。
- `models.ts`：四家账号级模型列表的请求、过滤与端点映射。`store.ts` 的 `syncGatewayModels` 负责只增不删的合并，以及 Copilot 双端点目录。
- `quota.ts`：现有四家及旧 Gemini 额度解析；`store.ts` / `lifecycle.ts`：加密、会话、版本、刷新和快照。
- `gateway.ts`：固定官方 URL、OAuth 请求头、Codex SSE 收集、Antigravity 包装、Copilot 按所选端点协议发往 `/chat/completions` 或 `/responses`，以及 Gemini 兼容。
- `app/api/admin/subscriptions/[[...path]]/route.ts`：管理 API；`app/(admin)/subscriptions/`：交互界面。
- `lib/services/provider-auth.ts`：关联服务商的旧 API Key 操作保护；`transfer-core.ts`：配置迁移隔离。

数据库使用 `subscription_accounts`、`subscription_oauth_sessions`、`subscription_provider_links` 三张表。账号表的 `models_error`、`models_synced_at`、`models_attempted_at` 三列在启动时原地添加，不重建表；以后若再次重建账号表，须先在目标表中加入这三列。旧账号表通过事务重建扩展 vendor 约束，保留所有旧账号和网关关联；旧 `gemini` 不改成 `antigravity`，不混用凭据，旧账号保留查询/刷新/删除能力，新建和重新登录入口停用。保留原 provider schema；OAuth 凭据不存放在 API Key 字段。加密复用 AES-256-GCM；浏览器列表只返回脱敏视图，授权会话由 HttpOnly / SameSite=Strict Cookie 绑定，10 分钟有效且只能使用一次。取消后清除会话和浏览器粘贴值。

控制面请求仅到固定官方目标，禁用重定向，20 秒超时，响应体上限 1 MiB；Google 项目初始化轮询有时间界限。管理 API 限制请求体大小、同源写入和缓存。Next.js 内部 URL 可能是 localhost，同源校验按真实 Host 对比；HTTPS 在反向代理终止时，配置 `MODEL_CENTER_PUBLIC_ORIGIN=https://models.example.com` 并重启；该配置同时用于同源校验和 Secure Cookie。只接受单一 http(s) origin，不含路径/查询/用户名，不自动信任 forwarded 请求头。沿用项目现有的管理面访问边界：本机或受信网络。

### 固定来源和许可证

本功能为独立 TypeScript 实现，参考协议行为，未复制上游 Go/Google 源码文件。`public/subscriptions/antigravity.svg` 原样取自 CLIProxyAPI 的 `assets/logo/antigravity.svg`，同目录附原始 MIT 许可证。Google 安装型 OAuth client 配置通过服务端环境变量注入，不再硬编码或随仓库分发；它与用户登录后生成的 token 分开管理。

- CLIProxyAPI **MIT**，SHA [`7fa443dc8bf8ca2f1ffd81c2472deb31b097b697`](https://github.com/router-for-me/CLIProxyAPI/tree/7fa443dc8bf8ca2f1ffd81c2472deb31b097b697)：Claude/Codex/Antigravity OAuth、请求执行、Antigravity `fetchAvailableModels` 模型接口及 Antigravity 图标。
- cc-switch **MIT**，SHA [`42ac174dbc42e0cf50a50e60c5f2c3dcecca4560`](https://github.com/farion1231/cc-switch/tree/42ac174dbc42e0cf50a50e60c5f2c3dcecca4560)：GitHub Copilot 设备码登录、会话令牌与推理域名、`/models` 请求头与过滤、推理请求头，以及 Codex OAuth `/models` 请求。
- openai/codex **Apache-2.0**，SHA `99cda7a9`：Codex `ModelInfo` 字段（`visibility`、`minimal_client_version`）的语义。
- CLIProxyAPI Gemini 删除前版本 **MIT**，SHA [`dd49a5200381f1849e489ed37f201c3741709634`](https://github.com/router-for-me/CLIProxyAPI/tree/dd49a5200381f1849e489ed37f201c3741709634)：历史 Gemini CLI 协议。当前 CLIProxyAPI 已删除 Gemini CLI OAuth，不能仅靠最新版本宣称支持。
- 管理界面 **MIT**，SHA [`c98751140127a39985df565b827eec0c20d131d3`](https://github.com/router-for-me/Cli-Proxy-API-Management-Center/tree/c98751140127a39985df565b827eec0c20d131d3)：Claude/Codex 额度字段及 Antigravity CLI 分组额度协议。
- Google Gemini CLI **Apache-2.0**，SHA [`9c1b0a610534d6f8120964cf2672c07807d8fc90`](https://github.com/google-gemini/gemini-cli/tree/9c1b0a610534d6f8120964cf2672c07807d8fc90)：旧 Gemini 兼容实现的授权码粘贴、项目发现、额度接口。完整证据见 `superpowers/specs/2026-09-14-subscription-accounts-design.md`。

### 验证记录（2026-09-14，Copilot 登录与模型自动接入）

本轮在未提交工作区上补全了 GitHub Copilot 设备码登录，参照 cc-switch `42ac174d`：页面显示设备码并轮询，按座席推理域名发请求，403 时提示无订阅。同时为四家实现账号级模型拉取，登录后自动全部接入网关，并为 Copilot 建立 Chat/Responses 双端点目录。上游 HTTP 全部为模拟响应，**未使用真实账号**。

- `npm run test:core`：343 项通过（此前 323 项）。新增 `subscription-models.test.ts`（四家请求、过滤、翻页、8 MiB 上限、目标白名单）和 `subscription-copilot.test.ts`（设备码 pending/slow_down/过期/拒绝、会话令牌、座席域名、403），并补充存储、网关请求与端点选择器用例。
- `npm run test:ui`：10 个文件 72 项通过，覆盖以下场景：
  - Copilot 加入真实路由与协议转换的 JSON/SSE 循环。
  - 只支持 Responses 的模型经 `/v1/chat/completions` 发往 `/responses`，反方向发往 `/chat/completions`。
  - 经 `/oauth/poll` 完成设备码登录后自动接入全部模型。
  - 模型拉取失败时保留登录，手动接入仍可用。
  - 界面设备码轮询、同步模型，以及失败后回退手动填写。
- `npm run typecheck`、`npm run build`、`git diff --check` 通过。CC Switch 生成文件（`lib/presets/cc-switch*`、`lib/pricing/cc-switch.ts`、`public/logos/*`）无改动；本轮未运行需要本地上游源码的 `sync:cc-switch -- --check`。
- `npx playwright test tests/e2e/subscriptions.spec.ts`：需在环境中提供 Antigravity 测试 client（如 `ANTIGRAVITY_OAUTH_CLIENT_ID=test-antigravity-e2e-client`、`ANTIGRAVITY_OAUTH_CLIENT_SECRET=test-antigravity-e2e-secret`），此时三种视口 9 项通过。不提供时，Antigravity 用例按设计返回 503 `configuration_required`，另外 6 项通过。Copilot 设备码界面目前只由 vitest/RTL 覆盖，没有浏览器 e2e。

### 验证记录（2026-09-14）

本次将误用的 Gemini CLI 个人授权切换为 Antigravity CLI 独立授权。旧 Gemini 个人客户端返回 `UNSUPPORTED_CLIENT` 后，重新生成同类链接或填写项目 ID 不能解决客户端已停用的问题。Antigravity 使用独立 OAuth 配置和回调；代码保留旧账号，但用户需重新发起 Antigravity 授权。

部署网络：如果浏览器已完成 Google 授权，但提交授权结果提示「上游网络请求失败」或 HTTP 502，应检查 **应用容器到官方 API** 的出站连通性。生成授权链接不需要连接 Google，因此生成成功并不能证明令牌兑换可用。可在外部运行环境设置 `MODEL_CENTER_SUBSCRIPTION_PROXY_URL=http://<容器可达代理地址>:<端口>` 并重建容器。此代理仅用于订阅 OAuth、刷新、额度与订阅网关调用；保留 TLS 证书校验、超时和禁止重定向约束。配置只接受无认证信息、无路径的 HTTP(S) 代理地址；不自动读取通用 `HTTP_PROXY` / `HTTPS_PROXY`，不影响普通 API Key 服务商。修复网络后应重新生成授权链接，旧授权会话在提交时已被消费，不能重复提交。

当前请求版本按固定上游快照实现（hub 2.9.1、额度 CLI 1.0.13）；未复制上游动态客户端版本更新、签名缓存、全部模型特例和工具 schema 修复。后续服务端协议变化需依据实际响应更新，不能用基本 JSON/SSE 测试宣称所有模型扩展兼容。

此前基线已通过（本次验证结果见 `antigravity-integration-plan.md`）：

- 核心测试 308 项；UI/运行时集成测试 63 项（含真实 SQLite/Drizzle/AES、管理路由及网关转换，上游 HTTP 使用模拟响应）。
- 三家 Chat 入口的 JSON/SSE 共 6 条网关路径；401 后令牌轮转重试、429 后别名账号回退、原生 Claude 能力请求头、Codex 原生 Responses data-only SSE 用量与字节保真、订阅日志不计 API 金额、API Key 旧接口回归。
- Playwright 6 项：375 / 768 / 1440 三种视口。真实 Next.js API 创建和取消 OAuth 会话、Cookie 属性；额度卡片为明确的测试 fixture，验证未知/耗尽/过时、模型输入以及无横向溢出。已人工查看桌面与手机截图。
- `npm run typecheck`、`npm run build`、`git diff --check`。
- CC Switch 固定 SHA `9a596158ca926e74b56243c08af67d9dd13fc27c` 的 `--check`：540 原始预设、255 变体、82 逻辑服务商、4 排除、192 定价、99 图标；覆盖账本 included 255 + merged 281 + excluded 4 = 540。生成文件无修改。

待真实账号验收：四家各完成一次登录、额度读取、模型自动拉取与接入、JSON 调用与 SSE 调用；重启后确认凭据保留及自然到期刷新。另需确认：Copilot 个人版 `endpoints.api` 的实际值、`/models` 的实际字段、`/responses` 的 JSON/SSE 返回；Claude OAuth 令牌能否调用 `/v1/models`；Codex `/models` 的响应大小，以及 `client_version` 对可见模型的影响；Antigravity `fetchAvailableModels` 对 `project` 的要求。尤其 Claude 对官方客户端身份和传输实现的校验、Google 项目和套餐权限仍需真实响应证明。未实现 CLIProxyAPI 的全部 TLS 指纹、WebSocket、管理面或所有私有客户端扩展，也不宣称与其完全等价。
