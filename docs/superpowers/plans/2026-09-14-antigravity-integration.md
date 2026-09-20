# Antigravity 授权接入

用户已明确将 Google 订阅入口改为 Antigravity，不使用 Gemini CLI 个人授权。

## 契约与范围

- 参考 CLIProxyAPI 固定快照 7fa443dc 的 `internal/auth/antigravity`、执行器及管理界面 c9875114 的 `retrieveUserQuotaSummary` 分组解析。
- 独立 `antigravity` vendor、OAuth 客户端环境变量、localhost:51121/oauth-callback 回调与 state 校验。旧 gemini 数据保留，不混用凭据；关闭新建 Gemini CLI 授权。
- loadCodeAssist 使用 ANTIGRAVITY 元数据；缺项目时通过 daily onboardUser 有界初始化。
- 额度读取 daily retrieveUserQuotaSummary，保留分组、5 小时/周窗口、零额度、未知额度及重置时间。
- 网关使用 daily generateContent/streamGenerateContent 和 Antigravity 请求封装；JSON/SSE 复用 Gemini 协议适配，维持现有令牌刷新和失败转移。
- 原生图标放 public/subscriptions，保留 Copilot/Grok 占位，不手改 CC Switch 生成文件。
- OAuth 客户端配置只写服务器外部环境，不提交 Git。现有统一网络设置不变。

## 顺序与验收

1. 独立授权与安全迁移（已验证）：先写测试，验证 OAuth state、客户端隔离、发现/初始化及旧账号/网关关联保留。
2. 额度和 JSON/SSE 网关（模拟上游已验证）：真实结构 fixture 验证百分比/时间、正确服务地址与报文、取消/刷新。
3. 界面与部署（本地已验证，待线上更新）：入口/图标/回调提示、端到端浏览器检查，npm test、typecheck、build、CC Switch --check。提交 main 后通过 ServerOps 更新。
4. 真实账号验收（待用户授权）：官方登录、额度及调用不得以模拟测试冒充。

## 本次验证（2026-09-14）

- 核心 316 项、UI/运行时集成 65 项通过，包含旧 vendor 约束升级、密文和外键关联保留、客户端隔离、非法回调、初始化取消和额度未知值。
- Playwright 9 项通过，覆盖 375/768/1440 视口、真实 Next.js 授权会话创建/取消及 Antigravity 回调地址。测试使用独立临时数据库和虚拟 OAuth 客户端配置，不向 Google 提交测试授权。已人工检查桌面亮色及手机暗色截图。
- TypeScript、生产构建、diff whitespace 检查通过。CC Switch 固定 SHA 9a596158ca926e74b56243c08af67d9dd13fc27c 的 --check 通过：540 原始预设、255 变体、82 逻辑服务商、4 排除、192 价格、99 图标，生成文件无改动。
- 服务器独立 Antigravity 客户端配置已注入外部环境文件，原文件和 SQLite 数据库已备份；未修改用户统一网络配置。真实账号登录、额度和推理仍待用户完成官方授权后验收。

- 独立审查发现并修复套餐级拒绝误判：允许默认套餐与其他 ineligibleTiers 并存时继续初始化，回归先失败后通过。Antigravity 资格以选定套餐的 onboard 结果为准。
