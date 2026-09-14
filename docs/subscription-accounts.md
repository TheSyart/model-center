# 订阅账号：登录、额度与网关

新增管理入口 `/subscriptions`，原生集成到 Model Center 的 Next.js 服务中，无需部署 CLIProxyAPI sidecar。实现参考固定版本的 CLIProxyAPI，并用 Google 官方 Gemini CLI 的当前源码核实 Gemini 协议；**没有执行真实账号的登录、额度查询或推理验收**。

## 使用

1. 启动现有 Model Center，进入侧栏 **订阅账号**。沿用当前 `MASTER_KEY` 和数据库目录。Gemini 登录另外需要在服务端配置 `GEMINI_OAUTH_CLIENT_ID` 和 `GEMINI_OAUTH_CLIENT_SECRET`，使用与官方 Code Assist 授权码流程兼容的客户端配置；配置值不随 Git 分发，缺失时显示明确错误。Claude/Codex 不需要这两个变量。
2. 授权登录厂商集中在订阅页，复用服务商目录中的图标。**GitHub Copilot、xAI (Grok)** 保留“尚未开放”占位，不发起未实现的登录；API Key 服务商选择器不再展示 OAuth-only 预设。选择 **登录 Claude Code / Codex / Gemini CLI**，生成链接后打开官方授权页。
3. Claude/Codex 授权后，复制浏览器地址栏的完整本地回调 URL。页面显示 localhost 无法访问不影响复制；本应用使用手动粘贴回调，无需开启回调监听端口。Google 使用官方授权码页面，复制授权码。返回 Model Center，粘贴并完成登录。
4. Gemini 个人账号可先留空项目；已有组织项目可填写 Google Cloud 项目 ID。项目必须已具备相应权限。登录与额度查询分别处理，额度查询失败不会删除有效登录。
5. 点击 **刷新额度** 或 **刷新全部额度** 获取厂商数据。页面每 60 秒读取本地快照；官方额度仅在登录后或手动刷新时查询，避免打开多个页面重复请求上游。
6. 点击 **接入网关**，填写该账号实际可用的模型 ID，每行一个。系统生成独立服务商 slug，例如 `oauth-codex-12345678`。不会把 API 模型目录当作订阅模型权限证明，也不会在保存时消费推理额度来试探权限。
7. 使用现有网关令牌调用 `slug/模型ID`，或到 **别名** 页面配置多个账号的有序回退。模型可在服务商的模型面板中启停、添加和删除。

调用示例（替换三个占位值）：

```sh
curl http://localhost:3000/v1/chat/completions \
  -H 'Authorization: Bearer YOUR_GATEWAY_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"model":"YOUR_PROVIDER_SLUG/YOUR_MODEL_ID","messages":[{"role":"user","content":"你好"}],"stream":false}'
```

现有 `/v1/chat/completions`、`/v1/messages`、`/v1/responses` 入口均复用原网关转换能力。Gemini 是上游协议，未增加对外 Gemini 原生路由。Codex 上游使用 Responses SSE，即使客户端要求 JSON，也由服务端收集终止事件再转换返回；Gemini 使用 Code Assist 请求和响应包装。

## 额度、账号与故障

- 额度以**账号、模型和时间窗口**展示。`0%` 是确实耗尽；缺少数值显示“未知”，不当作零或无限额。不同账号没有可以相加的统一余额。
- 查询失败保留上次成功快照并提示过时，显示重置时间与上次更新时间。不会自动重置额度、购买额度或兑换任何重置券。
- 每个账号的凭据独立刷新。到期前 60 秒或上游首次返回 401 时尝试刷新；同进程合并并发刷新，跨进程使用数据库租约及版本校验，避免刷新令牌重复消费或旧请求覆盖重新登录结果。
- 别名继续使用项目原有的回退策略：上游 429、网络失败或 5xx 可尝试下一目标。流式响应已开始输出后不自动切换账号。没有根据可能过时的额度快照提前跳过账号。
- 请求日志保留 token 用量，但订阅调用 `cost=null`，不会把 API 定价冒充套餐账单。因此现有**金额限额不限制订阅 token 消耗**；需要停止调用时禁用账号、模型或网关令牌。
- 禁用账号同步禁用关联服务商。删除账号前先断开网关；若别名仍引用关联服务商，需先移除引用。
- 普通 JSON 导出不含订阅授权、关联服务商和模型；混合别名仅保留 API Key 目标的原顺序，纯订阅别名不导出。文件内 `export_warnings` 记录排除情况。完整实例备份仍应保留数据库和原 `MASTER_KEY`，不要更换密钥后期待旧凭据自动恢复。

## 实现与维护

核心文件：

- `lib/subscriptions/oauth.ts`：PKCE、state、代码交换、刷新和 Google 项目初始化。
- `quota.ts`：三家额度解析；`store.ts` / `lifecycle.ts`：加密、会话、版本、刷新和快照。
- `gateway.ts`：固定官方 URL、OAuth 请求头、Codex SSE 收集、Gemini 包装。
- `app/api/admin/subscriptions/[[...path]]/route.ts`：管理 API；`app/(admin)/subscriptions/`：交互界面。
- `lib/services/provider-auth.ts`：关联服务商的旧 API Key 操作保护；`transfer-core.ts`：配置迁移隔离。

数据库新增 `subscription_accounts`、`subscription_oauth_sessions`、`subscription_provider_links` 三张表。保留原 provider schema；OAuth 凭据不存放在 API Key 字段。加密复用 AES-256-GCM；浏览器列表只返回脱敏视图，授权会话由 HttpOnly / SameSite=Strict Cookie 绑定，10 分钟有效且只能使用一次。取消后清除会话和浏览器粘贴值。

控制面请求仅到固定官方目标，禁用重定向，20 秒超时，响应体上限 1 MiB；Google 项目初始化轮询有时间界限。管理 API 限制请求体大小、同源写入和缓存。Next.js 内部 URL 可能是 localhost，同源校验按真实 Host 对比；HTTPS 在反向代理终止时，配置 `MODEL_CENTER_PUBLIC_ORIGIN=https://models.example.com` 并重启；该配置同时用于同源校验和 Secure Cookie。只接受单一 http(s) origin，不含路径/查询/用户名，不自动信任 forwarded 请求头。沿用项目现有的管理面访问边界：本机或受信网络。

### 固定来源和许可证

本功能为独立 TypeScript 实现，参考协议行为，未复制上游 Go/Google 源码文件。Google 安装型 OAuth client 配置通过服务端环境变量注入，不再硬编码或随仓库分发；它与用户登录后生成的 token 分开管理。

- CLIProxyAPI **MIT**，SHA [`7fa443dc8bf8ca2f1ffd81c2472deb31b097b697`](https://github.com/router-for-me/CLIProxyAPI/tree/7fa443dc8bf8ca2f1ffd81c2472deb31b097b697)：Claude/Codex OAuth、请求执行。
- CLIProxyAPI Gemini 删除前版本 **MIT**，SHA [`dd49a5200381f1849e489ed37f201c3741709634`](https://github.com/router-for-me/CLIProxyAPI/tree/dd49a5200381f1849e489ed37f201c3741709634)：历史 Gemini CLI 协议。当前 CLIProxyAPI 已删除 Gemini CLI OAuth，不能仅靠最新版本宣称支持。
- 管理界面 **MIT**，SHA [`c98751140127a39985df565b827eec0c20d131d3`](https://github.com/router-for-me/Cli-Proxy-API-Management-Center/tree/c98751140127a39985df565b827eec0c20d131d3)：Claude/Codex 额度字段。
- Google Gemini CLI **Apache-2.0**，SHA [`9c1b0a610534d6f8120964cf2672c07807d8fc90`](https://github.com/google-gemini/gemini-cli/tree/9c1b0a610534d6f8120964cf2672c07807d8fc90)：当前授权码粘贴、项目发现、额度接口。完整证据见 `superpowers/specs/2026-09-14-subscription-accounts-design.md`。

### 验证记录（2026-09-14）

已通过：

- 核心测试 308 项；UI/运行时集成测试 63 项（含真实 SQLite/Drizzle/AES、管理路由及网关转换，上游 HTTP 使用模拟响应）。
- 三家 Chat 入口的 JSON/SSE 共 6 条网关路径；401 后令牌轮转重试、429 后别名账号回退、原生 Claude 能力请求头、Codex 原生 Responses data-only SSE 用量与字节保真、订阅日志不计 API 金额、API Key 旧接口回归。
- Playwright 6 项：375 / 768 / 1440 三种视口。真实 Next.js API 创建和取消 OAuth 会话、Cookie 属性；额度卡片为明确的测试 fixture，验证未知/耗尽/过时、模型输入以及无横向溢出。已人工查看桌面与手机截图。
- `npm run typecheck`、`npm run build`、`git diff --check`。
- CC Switch 固定 SHA `9a596158ca926e74b56243c08af67d9dd13fc27c` 的 `--check`：540 原始预设、255 变体、82 逻辑服务商、4 排除、192 定价、99 图标；覆盖账本 included 255 + merged 281 + excluded 4 = 540。生成文件无修改。

待真实账号验收：三家各完成一次登录、额度读取、JSON 调用与 SSE 调用；重启后确认凭据保留及自然到期刷新。尤其 Claude 对官方客户端身份和传输实现的校验、Google 项目和套餐权限仍需真实响应证明。未实现 CLIProxyAPI 的全部 TLS 指纹、WebSocket、管理面或所有私有客户端扩展，也不宣称与其完全等价。
