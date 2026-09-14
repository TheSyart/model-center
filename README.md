# Model Center

个人模型聚合平台：统一管理模型服务商 API Key 和订阅 OAuth 账号，对外提供 OpenAI Chat / Anthropic Messages / OpenAI Responses 接口，并支持 Gemini 上游转换，通过 `model` 字段路由到不同服务商。单人自用定位。

## 功能

- **统一网关**：`POST /v1/chat/completions`（OpenAI）、`POST /v1/messages`（Anthropic，Claude Code 直连）、`POST /v1/responses`（OpenAI Responses，Codex）、`GET /v1/models`。入口协议与服务商原生协议一致时原生透传，否则经 IR（OpenAI Chat 中间格式）双向转换，支持流式 SSE、工具调用、图片输入。
- **模型路由**：`model` 支持三种写法——路由别名（如 `best-coding`，支持按序 failover）、`provider-slug/model`（显式）、裸模型名（全局匹配，priority 决胜）。
- **服务商管理**：固定 SHA 同步 CC Switch 的 10 类内置预设（当前 540 条源记录归一为 255 个端点变体）、192 条四档模型定价与 99 个图标；api_key AES-256-GCM 加密入库，支持连通性测速、模型列表同步、余额与 Coding Plan 查询。维护方式见 [`docs/cc-switch-sync.md`](docs/cc-switch-sync.md)。
- **订阅账号**：Claude Code、Codex、Antigravity CLI OAuth 登录，多账号额度窗口、凭据自动刷新、独立网关接入与别名回退。入口 `/subscriptions`；使用方法、部署配置和真实账号待验范围见 [订阅账号文档](docs/subscription-accounts.md)。
- **预设提示词**：`{{变量}}` 占位，网关请求带 `prompt_id`/`prompt_name` + `prompt_vars` 注入为 system message。
- **多令牌**：网关令牌管理（创建/启停/过期时间/花费限额与窗口），按令牌追踪用量。
- **日志与统计**：按 Codex、Claude Code、Kimi Code 等请求客户端识别入口，保留清理后的真实 User-Agent 来源；提供四档 Token 用量、估算成本看板和日志保留策略。
- **导入导出**：一键 JSON 导出（api_key 默认脱敏）/导入（冲突跳过）。
- **安全**：管理后台无认证（**仅限本机/受信网络**）；网关多令牌（sha256 存储）；base_url 强制 https（localhost 例外）。

> ⚠️ **无认证警告**：管理后台和所有 `/api/admin/*` 接口没有内置登录保护。请勿把本服务直接暴露到公网或不受信网络；生产环境由 ServerOps 在 HTTPS 入口启用统一 Auth，绕过该入口访问上游仍然是不安全的。

## ServerOps 管理

仓库中的 [`.serverops/service.json`](.serverops/service.json) 使用 v2 镜像发布约定，声明 `web` 服务、3000 端口、`/` 健康检查和挂载到 `/app/data` 的逻辑 `data`。CI 从同一提交构建 Next standalone、`.next/static` 与完整 `public`，由 ServerOps 校验后按 digest 发布。主密钥和服务环境只在运行时注入。迁移必须沿用该数据库原有的 `MASTER_KEY`，不可重新生成；服务商、模型与定价数据不属于本次适配。

## 快速开始

### 本地开发

```bash
npm install
cp .env.example .env.local
# 生成主密钥并填入 .env.local：
openssl rand -hex 32
npm run dev
```

打开 http://localhost:3000 直接进入后台（无登录）。网关令牌在「令牌」页查看/创建（旧版 settings.gateway_key 会自动迁移为「默认令牌」）。

### Docker

```bash
docker compose --env-file /absolute/path/compose.env -f compose.production.yml config
docker compose --env-file /absolute/path/compose.env -f compose.production.yml up -d
```

镜像、外部 env 和数据目录的配置见 [容器部署说明](docker/README.md)。

### 环境变量

| 变量 | 说明 |
|------|------|
| `MASTER_KEY` | 必填。AES-256-GCM 主密钥（64 位 hex，或任意字符串 sha256 派生）。生成：`openssl rand -hex 32` |
| `MODEL_CENTER_PUBLIC_ORIGIN` | 可选。HTTPS 反向代理后的公开 origin，例如 `https://models.example.com`，用于订阅登录同源校验和 Secure Cookie。 |
| `ANTIGRAVITY_OAUTH_CLIENT_ID` / `ANTIGRAVITY_OAUTH_CLIENT_SECRET` | Antigravity CLI 登录所需的独立服务端 OAuth 客户端配置，详见订阅账号文档；不提交实际值。 |

| `MODEL_CENTER_SUBSCRIPTION_PROXY_URL` | 可选。订阅 OAuth、令牌刷新、额度和订阅网关请求的 HTTP(S) 出站代理。容器必须能访问此地址；普通 API Key 服务商继续沿用原有网络路径。 |

数据库为单文件 SQLite（`data/model-center.db`），备份即拷贝。

## 接入示例

### OpenAI SDK / 任意 OpenAI 兼容客户端

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:3000/v1", api_key="<token>")  # 令牌在「令牌」页创建
client.chat.completions.create(model="best-coding", messages=[...])
```

### Claude Code（Anthropic 出口）

```bash
export ANTHROPIC_BASE_URL=http://localhost:3000
export ANTHROPIC_AUTH_TOKEN=<token>
claude
```

### Codex（Responses 出口）

```toml
# ~/.codex/config.toml
model_provider = "model-center"
[model_providers.model-center]
base_url = "http://localhost:3000/v1"
env_key = "MODEL_CENTER_KEY"
```

### Gemini 服务商

Gemini 原生协议的服务商（protocol 选 `gemini`）由适配器转换接入，从任意入口（OpenAI/Anthropic/Responses）调用均可。Gemini 原生协议的对外入口（`/v1beta/...:generateContent`）暂未实现。

### 预设提示词注入

```json
{
  "model": "best-coding",
  "prompt_name": "code-review",
  "prompt_vars": { "language": "TypeScript" },
  "messages": [{ "role": "user", "content": "..." }]
}
```

## 文档

完整设计与开发文档见 [docs/development-doc.md](docs/development-doc.md)。

## 开发

```bash
npm run dev    # 开发
npm run build  # 生产构建
npm start      # 生产启动
```

`tests/` 下有四个协议的 mock 上游脚本（`node tests/mock-upstream.mjs 3999` 等），供本地验收网关转换逻辑。
