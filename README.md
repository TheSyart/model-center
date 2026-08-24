# Model Center

个人模型聚合平台：把各家模型服务商的 API Key 统一收进来，对外暴露统一的 OpenAI / Anthropic / Responses / Gemini 四协议接口，通过 `model` 字段路由到不同服务商。单人自用定位。

## 功能

- **统一网关**：`POST /v1/chat/completions`（OpenAI）、`POST /v1/messages`（Anthropic，Claude Code 直连）、`POST /v1/responses`（OpenAI Responses，Codex）、`GET /v1/models`。入口协议与服务商原生协议一致时原生透传，否则经 IR（OpenAI Chat 中间格式）双向转换，支持流式 SSE、工具调用、图片输入。
- **模型路由**：`model` 支持三种写法——路由别名（如 `best-coding`，支持按序 failover）、`provider-slug/model`（显式）、裸模型名（全局匹配，priority 决胜）。
- **服务商管理**：固定 SHA 同步 CC Switch 的 10 类内置预设（当前 540 条源记录归一为 255 个端点变体）、192 条四档模型定价与 99 个图标；api_key AES-256-GCM 加密入库，支持连通性测速、模型列表同步、余额与 Coding Plan 查询。维护方式见 [`docs/cc-switch-sync.md`](docs/cc-switch-sync.md)。
- **预设提示词**：`{{变量}}` 占位，网关请求带 `prompt_id`/`prompt_name` + `prompt_vars` 注入为 system message。
- **多令牌**：网关令牌管理（创建/启停/过期时间/花费限额与窗口），按令牌追踪用量。
- **日志与统计**：按 Codex、Claude Code、Kimi Code 等请求客户端识别入口，保留清理后的真实 User-Agent 来源；提供四档 Token 用量、估算成本看板和日志保留策略。
- **导入导出**：一键 JSON 导出（api_key 默认脱敏）/导入（冲突跳过）。
- **安全**：管理后台无认证（**仅限本机/受信网络**）；网关多令牌（sha256 存储）；base_url 强制 https（localhost 例外）。

> ⚠️ **无认证警告**：管理后台和所有 `/api/admin/*` 接口没有登录保护。请勿把本服务暴露到公网或不受信网络；如需公网访问，请在反向代理层加 Basic Auth / IP 白名单并启用 HTTPS。

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
docker build -t model-center .
docker run -d --name model-center \
  -e MASTER_KEY=$(openssl rand -hex 32) \
  -p 3000:3000 \
  -v model-center-data:/app/data \
  model-center
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `MASTER_KEY` | 必填。AES-256-GCM 主密钥（64 位 hex，或任意字符串 sha256 派生）。生成：`openssl rand -hex 32` |

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
