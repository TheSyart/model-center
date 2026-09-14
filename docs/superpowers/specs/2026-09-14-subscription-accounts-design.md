# 订阅账号 OAuth、额度与网关接入设计

日期：2026-09-14。状态：用户已通过 go on 确认原生方案，代码已实现并执行自动化及浏览器验收；真实账号授权与调用待验。最终使用及验证记录见 `../../subscription-accounts.md`。

## 1. 当前项目与接入位置

Model Center 使用 Next.js 15、React 19、TypeScript、SQLite/better-sqlite3 和 Drizzle。现有入口为 OpenAI Chat、Anthropic Messages、OpenAI Responses。Gemini 是上游适配器，不是已实现的对外原生入口。

- `lib/db/schema.ts` / `lib/db/index.ts`：providers、provider_endpoints、models、request_logs、balance_snapshots 与幂等迁移。
- `lib/crypto.ts`：基于既有 MASTER_KEY 的 AES-256-GCM 加密，可复用，不生成或替换用户主密钥。
- `lib/gateway/router.ts`：别名、有服务商前缀的模型、裸模型选择。
- `lib/gateway/pipeline.ts` / `attempt-builder.ts` / `forward.ts`：按端点原生透传或协议转换、发起请求、记录结果。当前 buildAttemptForEndpoint 同步解密 apiKeyEnc，不支持异步刷新 OAuth 凭据。
- `lib/services/balance.ts` / `coding-plan.ts`：API Key 余额及套餐查询；现有 QuotaTier 的 utilization 不可空，不能直接表达 OAuth 的未知额度。
- `lib/services/model-sync.ts`：按端点同步模型和定价；订阅账号的可调用模型必须有独立来源，不可把普通 API 目录当作订阅权益证明。
- `components/nav.tsx`：新增“订阅账号”入口，沿用现有 Radix/shadcn 组件和样式。
- `lib/services/transfer-core.ts`：现有配置导入导出；OAuth refresh token 不进入普通配置导出。
- `.serverops/service.json` / `compose.production.yml`：现有生产配置只有 web 服务。额外 Go 进程/容器意味着部署约定变化，不是单纯增加页面。

所有 CC Switch 生成文件保持原样。OAuth 账号不通过修改生成预设来假装支持。现有服务商 ID、slug、Key、URL、优先级、端点、启停、备注及手动模型价格保持不变。已有未提交的安全演示、旁白和封面文件不属于本次修改。

## 2. 已固定的上游证据

| 来源 | 固定提交 | 用途 |
|---|---|---|
| CLIProxyAPI，当前 main / v7.3.2 | `7fa443dc8bf8ca2f1ffd81c2472deb31b097b697` | Claude/Codex 登录、刷新、执行器与管理 API |
| CLIProxyAPI，Gemini 删除提交 | `78ba8ba731dd531437947a6e0aadda4c13817907` | 2026-06-18 删除 Gemini CLI OAuth/执行器的证据 |
| CLIProxyAPI，删除前父提交 | `dd49a5200381f1849e489ed37f201c3741709634` | Gemini CLI OAuth、项目发现、请求包装与执行器 |
| Cli-Proxy-API-Management-Center | `c98751140127a39985df565b827eec0c20d131d3` | 当前 Claude/Codex 额度接口、字段解析与展示 |
| 同一管理界面，历史额度常量 | `c595ada80d20c3e3b028fc87462462fd46b1babf` | Gemini CLI retrieveUserQuota 接口证据 |
| Google 官方 Gemini CLI | `9c1b0a610534d6f8120964cf2672c07807d8fc90` | 当前 OAuth、授权码粘贴、项目发现与额度字段契约 |

链接：

- [当前后端源码](https://github.com/router-for-me/CLIProxyAPI/tree/7fa443dc8bf8ca2f1ffd81c2472deb31b097b697)
- [Gemini CLI 删除提交](https://github.com/router-for-me/CLIProxyAPI/commit/78ba8ba731dd531437947a6e0aadda4c13817907)
- [历史 Gemini OAuth](https://github.com/router-for-me/CLIProxyAPI/blob/dd49a5200381f1849e489ed37f201c3741709634/internal/auth/gemini/gemini_auth.go)
- [当前管理界面额度适配器](https://github.com/router-for-me/Cli-Proxy-API-Management-Center/tree/c98751140127a39985df565b827eec0c20d131d3/src/features/quota/providers)
- [历史 Gemini 额度接口](https://github.com/router-for-me/Cli-Proxy-API-Management-Center/blob/c595ada80d20c3e3b028fc87462462fd46b1babf/src/utils/quota/constants.ts)
- [OpenAI 官方认证文档](https://learn.chatgpt.com/docs/auth)
- [Google 当前 OAuth 实现](https://github.com/google-gemini/gemini-cli/blob/9c1b0a610534d6f8120964cf2672c07807d8fc90/packages/core/src/code_assist/oauth2.ts)
- [Google 当前项目发现](https://github.com/google-gemini/gemini-cli/blob/9c1b0a610534d6f8120964cf2672c07807d8fc90/packages/core/src/code_assist/setup.ts)
- [Google 当前额度类型](https://github.com/google-gemini/gemini-cli/blob/9c1b0a610534d6f8120964cf2672c07807d8fc90/packages/core/src/code_assist/types.ts)

关键结论：不能使用最新版 CLIProxyAPI 便宣称支持 Gemini CLI OAuth。不能把仍支持的 Gemini API Key 或 Antigravity 登录当作 Gemini CLI 登录。Google 官方当前源码仍保留 OAuth、相同客户端配置及 retrieveUserQuota，补足了历史实现的当前契约依据；源码仍不证明具体账号可以登录或调用。三家的真实账号授权、额度与推理均需实测。

上游 MIT 声明应随实际移植代码保留，并记录每个移植模块的来源 SHA；不复制完整仓库到项目。

Google 官方源码采用 Apache-2.0。如移植其代码片段，应保留对应许可与归属，不将该部分错误标记为 CLIProxyAPI 的 MIT 代码。

## 3. 集成方案

### A. 原生移植（建议）

在 Model Center 增加独立订阅账号领域模块。认证、额度查询和订阅请求适配由服务端 TypeScript 实现；现有网关继续负责用户令牌、别名、日志和协议转换。

好处：同一界面、同一加密存储、沿用单服务部署、可以精确记录每个账号调用。代价：需要持续跟踪三家认证、订阅端点和协议变化；Claude 上游有专门传输及客户端兼容代码，Node 原生 fetch 是否满足当前上游要求必须由真实验证决定，不能单凭单测宣称等价。

### B. 复用独立 CLIProxyAPI 服务

Model Center 通过管理 API 发起登录、查询账号、查询额度，以其兼容模型端点作为网关上游。优点是复用 Claude/Codex 的完整协议细节；代价是新增常驻服务、凭据跨服务存放、账号级路由和日志归属需要额外契约。Gemini 需要经过审查的兼容实现，不能直接由当前 v7.3.2 提供。冻结整个旧版会丢失近几个月其他厂商的更新，不作为推荐默认值。

### C. 只做本地 CLI 凭据导入

不能满足用户确认的网页登录与完整生命周期需求，排除。不会擅自读取 ~/.codex、~/.claude、~/.gemini 或系统钥匙串来“自动导入”。

## 4. 用户体验与验收范围

“订阅账号”页提供三类登录按钮、账号列表、账号启停/重新登录/删除、刷新额度、加入网关。支持每家多个账号。账号卡显示厂商、邮箱或账号标识、套餐（有证据才显示）、登录状态、最近额度查询时间、各限额窗口剩余百分比及重置时间。

登录：选择厂商 → 创建授权会话 → 打开官方授权 URL → 用户完成登录 → 回调完成 → 账号入库 → 尝试查询额度。若额度失败，保留登录成功和查询错误两个独立状态。

本机回调与服务器部署必须分开考虑：上游 redirect URI 指向浏览器所在主机的 localhost，并不会自动回到远程 Next.js 服务。首版必须提供“粘贴完整回调 URL”流程；校验 state、厂商及预期 redirect URI 后在服务端换取 token。可用的本机监听方式作为便利路径，端口占用时明确回退，不终止用户已有 CLI 进程。

Gemini 首选官方 `authWithUserCode` 流程：PKCE S256，redirect URI 为 `https://codeassist.google.com/authcode`，用户复制网页显示的授权码到账号弹窗，服务端使用该会话的 verifier 和相同 redirect URI 换码。此流程不需要开放 localhost 8085，不是 device-code 轮询流程。授权码提交必须绑定发起浏览器的 HttpOnly 会话 cookie；不把没有回传 state 的手动授权码伪装成“已验证回调 state”。真正的 URL 回调仍逐项校验 state 和预期 URI。

Gemini 登录若需要项目，显示项目字段和可操作错误。仅按上游发现/引导协议解析项目，不凭空生成 project ID。免费层 onboarding 必须省略 cloudaicompanionProject；其他层按实际项目提交。若上游返回 long-running operation，则读取 operation 状态直到完成，设置明确超时并支持取消；不重复提交 onboarding 来替代轮询。上游要求额外账号验证或项目权限时返回受控错误；仅把通过 HTTPS 与 Google 账号域名白名单校验的验证 URL 作为文本返回，不转发任意上游链接，不宣称登录后必然可用。

“统一管理”表示统一入口、状态与数据结构，不表示能增加上游限额，也不把不同账号/不同窗口的百分比相加。不会自动购买额度或消费重置券。

## 5. 原生方案的数据与生命周期

实际实现采用三张新表：

- `subscription_accounts`：账号 ID、厂商、按原账号 ID/组织/项目组合生成的去重键、邮箱、显示名、加密 Credential、过期时间、启停、认证状态、版本、刷新租约与退避。组织保存在加密凭据中；quota_json、quota_error、quota_attempted_at 同行存储最新快照和错误，版本条件更新避免旧查询覆盖重新登录。
- `subscription_oauth_sessions`：随机 ID、owner_hash、加密的完整 Authorization（state/verifier/redirect）、可选项目及重新登录目标、过期时间。有效期 10 分钟；单次消费；不会记录完整回调或凭据。
- `subscription_provider_links`：account_id 唯一外键、provider_id 主键。替代修改 providers 的原始设想，保持旧 schema 兼容。每个账号单独建一个服务商，使按 provider 的日志可归属到账号。OAuth 凭据不放进 API Key 字段；删除关联账号前需解除网关，别名仍引用时阻止解除。

刷新：到期前 60 秒刷新；同账号 single-flight，使用数据库版本条件更新保护多进程；保留未返回的新 refresh_token；401 仅允许一次刷新重试；invalid_grant 标 needs_reauth；429/临时网络错误保留凭据并退避。已删除或重新登录的旧刷新任务不得覆盖新凭据。

新增写接口执行同源检查；响应 Cache-Control: no-store。沿用项目现有受信管理入口的部署边界，浏览器只获得授权 URL、state 会话标识和脱敏账号资料。OAuth 控制面请求不经过“原始数据”捕获链。

## 6. 三家专属契约

| 厂商 | 登录/凭据 | 额度 | 推理执行差异 |
|---|---|---|---|
| Claude Code | PKCE；claude.ai/oauth/authorize；当前 token endpoint 为 platform.claude.com/v1/oauth/token；上游回调 localhost:54545/callback | api.anthropic.com/api/oauth/usage；utilization、resets_at；命名窗口及可能存在的 limits；profile 独立查询 | Messages 协议、Bearer 与 OAuth beta、客户端兼容请求头/消息规则；工具调用和流式事件不能退化 |
| Codex | PKCE；auth.openai.com/oauth/authorize 和 /oauth/token；回调 localhost:1455/auth/callback；身份包含 ChatGPT account/workspace | chatgpt.com/backend-api/wham/usage；rate_limit、code_review_rate_limit、additional_rate_limits；used_percent、limit_window_seconds、reset_at | chatgpt.com/backend-api/codex/responses；账号头；订阅端点强制流式的行为必须适配非流式客户端 |
| Gemini CLI | Google OAuth + PKCE 授权码粘贴；loadCodeAssist/onboardUser 发现项目；可选 loopback 回调 | POST cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota，请求含 project；按真实返回 bucket/model 显示 | Code Assist v1internal，项目与请求体包装，response 解包；不是普通 generativelanguage API Key 接口 |

统一额度窗口字段：id、label、model_id、used_percent:number|null、remaining_percent:number|null、reset_at:number|null、window_seconds:number|null。仅当已知百分比合法时推导补数；不把缺失、空字符串、NaN 或格式错误当作 0。Codex 不能硬编码所有 secondary_window 都是 7 天，应读取实际秒数。Gemini 模型共享额度时不按模型数累加。

Google 当前额度响应为 `{ buckets?: BucketInfo[] }`；每个 bucket 可有 remainingAmount（字符串）、remainingFraction（数字）、resetTime、tokenType、modelId。remainingFraction 为 0 表示确实耗尽，不是字段缺失；百分比等于 fraction × 100。仅有 remainingAmount 不能推导总额或使用百分比；没有窗口长度字段时保持 window_seconds 为 null。bucket 的 tokenType 与 modelId 一起参与身份标识，避免同模型多种额度互相覆盖。

## 7. 网关集成

账号连接网关时创建新的稳定服务商 slug 和独立关联，不覆盖既有 API Key 服务商。通过现有模型页/别名能力选择模型；账号可用模型需要来自可验证目录或用户明确配置，并显示来源，禁止凭 API 公共模型列表推断订阅可用性。

2026-09-14 更新：“可验证目录”是指各厂商以该账号凭据鉴权的官方模型接口，即 Copilot `/models`、Codex `/backend-api/codex/models`、Claude `/v1/models`、Antigravity `fetchAvailableModels`。登录成功后自动拉取并全部接入，界面显示同步时间与来源；拉取失败时回退到用户手动填写，仍不使用公共目录或静态模型表。

新增订阅执行适配层：先解析账号并刷新，再执行厂商协议包装。原生协议入口尽量保留原始请求字段；跨协议仍由现有适配器转换。正常文本、工具调用、流式、非流式、usage、上游错误、客户端断开都必须纳入验收。

多账号切换使用显式别名 targets 的现有 failover 行为。新鲜且明确耗尽的窗口可作为冷却依据；陈旧额度不永久封锁账号。流式已向客户端发送内容后不切换账号，以免重复输出和重复工具执行。上游 429 与额度快照分别记录，不把清除本地冷却状态叫作“恢复官方额度”。

订阅成本不能直接用公共 API 单价表示为实际账单。日志保留 token 与时延，成本未知显示空；如果展示参考 API 成本，必须明确是估值并与实际扣费分开。

## 8. 实施顺序与验证

1. 账号表/迁移、加密存储、脱敏序列化和会话状态机。旧数据库与用户数据不变性测试。
2. OAuth URL/PKCE/回调校验、三家换码与刷新。测试 state 不符、过期、重放、拒绝授权、token 轮换、并发刷新、重新登录冲突和脱敏。
3. 三家额度请求与规范化、持久快照、错误保留旧数据。覆盖 0/100/未知/非法数值、秒/毫秒/ISO 重置时间、多窗口、多模型及 401/403/429/5xx。
4. 订阅账号管理 API 与页面，测试登录成功、失败、等待、过期、重新登录、禁用、删除关联保护和缺少 Gemini project。
5. 账号关联服务商、模型与订阅执行器。每家均验证 Chat/Messages/Responses 兼容边界，尤其 Codex SSE→非流式聚合、Gemini envelope 和工具调用。
6. 完整回归、生产构建、浏览器验收、真实账号授权与一次明确的模型调用。没有真实授权的项目标“未验证”，不能把 mock 成功写成真实可用。

检查命令：`npm test`、`npm run typecheck`、`npm run build`、`git diff --check`。按 AGENTS.md 运行固定 SHA 的 CC Switch `--check` 并核实生成文件零差异。测试与开发服务使用独立 MODEL_CENTER_DB_DIR，禁止改动用户真实数据库作为测试准备。

交付记录须分别列出：已实现、自动测试通过、浏览器验证通过、每家真实登录/额度/调用是否通过、仍受上游兼容影响的限制。部署、真实账号操作与代码完成是不同状态。
