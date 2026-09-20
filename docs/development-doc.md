# Model Center —— 个人模型聚合平台 · 开发文档

> 体裁：契约 · 状态：在用 · 最后核对：2026-09-20
> 版本：v0.5（初稿 2026-08-24）
> 本次核对只处理了结构性失真——删掉了已与代码不符的「目录结构」一节；
> 其余章节未逐条复核，与实现不一致时以代码为准。
> 定位：单人自用的模型 API 聚合网关 + 管理后台。把各家模型服务商的 API Key 统一收进来，对外只暴露一个兼容 OpenAI 协议的接口，通过模型名路由到不同服务商；同时提供服务商管理、预设提示词、额度查询、模型列表同步等管理能力。
> 服务商、模型、定价与图标固定同步自 [farion1231/cc-switch](https://github.com/farion1231/cc-switch)；精确 SHA、字段映射和更新流程见 `docs/cc-switch-sync.md`。

---

## 1. 项目概述

### 1.1 要解决的问题

- 手里有多个模型服务商的 API Key（OpenAI、Anthropic、DeepSeek、Kimi、智谱、通义、Gemini、Grok、火山方舟、SiliconFlow、OpenRouter……），每家 base_url、鉴权方式、协议格式不同。
- 希望**一个接口**调用所有模型：对外同时暴露 OpenAI 兼容协议（`/v1/chat/completions`）和 Anthropic 兼容协议（`/v1/messages`），任意客户端（OpenAI SDK、Claude Code、Codex、各类 agent）只需填一个 base_url + 一个 Key，通过 `model` 字段选择不同服务商的模型。
- 希望统一管理各家 Key、随时查看剩余额度、同步各家支持的模型列表。
- 希望维护一套可复用的**预设提示词**（系统提示词模板），调用时按名引用。

### 1.2 范围与非目标

**范围内（v1）**：

- 模型类型：**文本模型 + 多模态模型（视觉输入）**，面向 coding / agent 场景。
- 调用方式：非流式 / SSE 流式 / **工具调用（tool/function calling）全链路透传与转换** / 多轮对话 / 图片输入（base64 与 URL）。
- 出口协议：OpenAI 兼容 + Anthropic 兼容双协议（后者供 Claude Code 等 agent 直连）。

**非目标（Out of Scope）**：

- 多用户 / 租户体系、计费收款、Key 对外分发（单人自用，不做成 SaaS）。
- embeddings、图像生成、语音、视频等**非 chat 类模型与端点**。
- 模型微调、文件上传批处理、向量库等周边能力（后续可扩展）。
- 负载均衡、多 Key 轮询（v1 一个服务商一个 Key 即可，预留扩展字段）。

---

## 2. 功能需求

### 2.1 功能清单（MoSCoW）

| # | 功能 | 优先级 | 说明 |
|---|------|--------|------|
| F1 | 服务商管理（Provider CRUD） | Must | 名称、协议类型、base_url、api_key（加密存储）、启用/禁用、备注 |
| F2 | 统一推理网关 | Must | 对外提供 OpenAI 兼容 `POST /v1/chat/completions`，按模型名路由到对应服务商，做协议转换 |
| F3 | 协议适配器 | Must | 三类：OpenAI 兼容 / Anthropic Messages / Google Gemini；均需支持**工具调用与多模态（图片）输入**的互转 |
| F3b | Anthropic 兼容出口 | Must | 对外暴露 `POST /v1/messages`（Anthropic 协议），供 Claude Code / agent 直连，内部统一转换为 OpenAI 中间格式再走适配器 |
| F4 | 模型列表同步 | Must | 一键拉取各服务商支持的模型列表并入库；也支持手动增删模型、给模型起别名 |
| F5 | 额度/余额查询 | Must | 支持官方提供余额接口的服务商一键查询；不支持的显示"不支持"并附跳转链接 |
| F6 | 预设提示词（Prompt Presets） | Must | 提示词 CRUD，支持 `{{变量}}` 占位；调用时可通过 `prompt_id` + 变量渲染为 system message |
| F7 | 流式转发（SSE） | Must | `stream: true` 时逐 chunk 透传/转换，含 tool_calls 增量事件 |
| F8 | 请求日志 | Should | 记录每次调用的服务商、模型、token 用量、耗时、状态；可按服务商/模型/时间筛选 |
| F9 | 用量统计看板 | Should | 按服务商/模型聚合 token 用量与估算成本（自定义单价） |
| F10 | 连通性测试 | Should | 对服务商发起一次轻量请求测延迟与可用性（"测速"） |
| F11 | 模型路由别名 | Should | 定义虚拟模型名（如 `best-coding`）映射到具体 `provider/model`，客户端只用别名 |
| F12 | 失败自动切换（Failover） | Could | 给别名配置备选模型，主模型失败时自动降级 |
| F13 | 导入/导出配置 | Could | JSON 导入导出所有服务商与提示词配置 |
| F14 | 网关令牌 | Must | 多令牌管理（创建/启停/过期/花费限额）；管理后台无认证（本机/受信网络使用） |
| F15 | Coding Plan 套餐查询 | Should | Kimi/智谱/MiniMax/ZenMux 套餐配额档位（非金额）；火山需 AK/SK 签名暂不支持 |

### 2.2 典型使用流程

1. 在后台"服务商"页新增 DeepSeek：选预设 → 填 Key → 保存 → 点"测速"验证连通 → 点"同步模型"拉取模型列表。
2. 在"模型"页给 `deepseek-chat` 设置别名 `ds`。
3. 在"提示词"页新建预设 `code-review`，内容为 `你是资深工程师，请用{{language}}审查以下代码…`。
4. 客户端（任意 OpenAI SDK / Claude Code / 自写脚本）把 base_url 指向本服务，`model: "ds"`，即可调用。
5. 在"额度"页一键查看各家余额；在"日志"页排查失败请求。

---

## 3. 服务商范围与接入要点

### 3.1 收录的服务商（完全同步 cc-switch 预设）

> v0.4 起改为**完全同步** cc-switch 的预设（不再只保留主流 13 家）。

- 固定来源提交为 `9a596158ca926e74b56243c08af67d9dd13fc27c`。同步覆盖 Claude、Claude Desktop、Codex、Gemini、Grok Build、OpenCode、OpenClaw、Hermes、Pi、Universal 共 10 类；539 条数组记录加独立 Grok Official，合计 540 条，规范化为 255 个协议/Base URL 变体。
- 每条源记录必须归入 included、merged 或 excluded 覆盖账本。OAuth-only、Bedrock 等不支持项保留元数据但在选择器禁用；无可执行 Base URL 的自定义模板明确进入排除项。
- 同一厂商仅在“身份、协议、规范化 Base URL”全部一致时合并；不同协议或端点保留为独立变体。稳定 slug 和旧 slug 兼容由 `lib/presets/index.ts` 处理，不再把 legacy 与生成预设重复拼接。
- 分类映射包含 official、cn_official、cloud_provider、aggregator、third_party/relay、other，UI 按分类分组。
- Logo：厂商图标取自 cc-switch `src/icons/extracted/`（99 个，按 `index.ts` 逻辑键映射并保留实际扩展名存于 `public/logos/`），预设带 `logo` 字段，无物理资源的厂商前端用首字母占位图。
- 预设的额外配置（claude 系默认模型 env、codex 系 config.toml 等）存入预设 `extra` 字段，仅保存展示，网关暂不消费。

下表保留 13 家主流厂商的接入说明；运行时预设统一来自生成目录，本地推荐、余额与 Coding Plan 行为按稳定 slug 覆盖：

| 服务商 | 协议 | Base URL | 模型列表接口 | 余额查询接口 | 备注 |
|--------|------|----------|--------------|--------------|------|
| OpenAI | OpenAI / Responses | `https://api.openai.com/v1` | `GET /models` | 用量 API（需按当前官方文档适配） | Codex 系列走 Responses API |
| Anthropic | Anthropic | `https://api.anthropic.com` | `GET /v1/models` | 无公开余额接口（Console 查看） | 需协议转换 |
| Google Gemini | Gemini | `https://generativelanguage.googleapis.com` | `GET /v1beta/models` | 无 | 需协议转换 |
| DeepSeek | OpenAI 兼容 | `https://api.deepseek.com/v1` | `GET /models` | `GET /user/balance` | 余额返回 CNY/USD 双币种 |
| Moonshot Kimi | OpenAI 兼容 | `https://api.moonshot.cn/v1` | `GET /models` | `GET /users/me/balance` | |
| 智谱 GLM | OpenAI 兼容 | `https://open.bigmodel.cn/api/paas/v4` | `GET /models` | 无简易接口（需确认） | |
| 阿里百炼（通义 Qwen） | OpenAI 兼容 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `GET https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/models`（独立目录地址，分页） | 控制台查看 | 普通百炼模型同步使用官方 Workspace 目录；推理 Base URL 不变 |
| 火山方舟（豆包） | OpenAI 兼容 | `https://ark.cn-beijing.volces.com/api/v3` | `GET /models` | 控制台查看 | |
| xAI Grok | OpenAI 兼容 | `https://api.x.ai/v1` | `GET /models` | 需确认 | |
| Mistral | OpenAI 兼容 | `https://api.mistral.ai/v1` | `GET /models` | 控制台查看 | |
| OpenRouter | OpenAI 兼容 | `https://openrouter.ai/api/v1` | `GET /models` | `GET /auth/key`（返回用量/限额） | 聚合平台 |
| SiliconFlow | OpenAI 兼容 | `https://api.siliconflow.cn/v1` | `GET /models` | `GET /user/info` | 聚合平台 |
| PPIO | OpenAI 兼容 | `https://api.ppinfra.com/v3/openai` | `GET /models` | 需确认 | 聚合平台 |

> ⚠️ 余额/用量接口以各服务商**当前官方文档**为准，上表为接入起点；适配器层需允许"自定义余额查询端点 + JSONPath 提取规则"，应对接口变动。
> 中转/relay 站（PackyCode、ZetaAPI 等）现已随 cc-switch 全量预设收录，分类标记为 relay（中转/第三方），自行甄别使用。

### 3.2 协议适配器设计（参考 cc-switch proxy 模块设计）

**四种 API 格式**（与 cc-switch 对齐）：每个服务商有一个**原生协议**；入口请求格式与服务商原生协议一致时**直接透传（原生）**，不一致时经中间格式**转换路由（需开启路由）**。

| 格式 | 入口路径 | 典型服务商 |
|------|----------|-----------|
| Anthropic Messages | `POST /v1/messages` | Anthropic |
| OpenAI Chat Completions | `POST /v1/chat/completions` | OpenAI 及全部 OpenAI 兼容厂商 |
| OpenAI Responses API | `POST /v1/responses` | OpenAI（Codex 系列） |
| Gemini Native generateContent | `POST /v1beta/models/{model}:generateContent`（及 `:streamGenerateContent`） | Google Gemini |

```text
 入口（四协议，均可接任意服务商）
   /v1/chat/completions ─┐
   /v1/responses ────────┤
   /v1/messages ─────────┼─► 统一网关 ──► 路由: model → provider
   /v1beta/...:generateContent ─────────────┘          │
                          ┌────────────────────────────┤
                          ▼ 入口格式 == 原生协议?       │
                    ┌──────────┐            ┌───────────▼───────────┐
                    │ 原生透传  │            │ 经 IR 转换（开启路由）  │
                    │ 仅改写鉴权 │            │ 入口格式→IR→原生协议    │
                    │ /model 名 │            └───────────────────────┘
                    └──────────┘
```

- **内部中间格式（IR）**：网关内部统一使用 OpenAI Chat Completions 格式作为中间表示。任意入口请求先转为 IR（原生透传时跳过），再按目标服务商协议转出；响应反之。OpenAI Responses API 与 Chat Completions 之间的互转（`input`/`instructions` ↔ `messages`、`output` items ↔ `choices`、`response.function_call` ↔ `tool_calls`）也走 IR。
- **OpenAI 兼容**：覆盖面最大（DeepSeek/Kimi/GLM/Qwen/火山/xAI/Mistral/OpenRouter/SiliconFlow/PPIO），原生透传时只需替换 base_url 和 Authorization 头、改写 `model` 字段为上游真实模型名。
- **Anthropic**：`messages` 结构转换（system 抽出为顶层字段、`max_tokens` 必填、`tools`/`tool_calls` ↔ `tools`/`tool_use`/`tool_result` 互转、流式事件 `content_block_delta` / `input_json_delta` ↔ `chat.completion.chunk` 转换）。
- **Gemini**：`contents`/`parts` 结构转换，`functionDeclarations`/`functionCall`/`functionResponse` ↔ OpenAI tools 互转，图片 `inline_data` ↔ `image_url` 互转，`generateContent` / `streamGenerateContent` ↔ OpenAI 格式；流式默认走 `:streamGenerateContent` + SSE。
- **工具调用**：四种协议的 tool 定义、tool_calls/tool_use/functionCall 块、tool 结果回传均需完整互转（agent 场景的硬性要求）；流式下需正确处理增量拼装。
- **多模态**：OpenAI `image_url`（base64 data URL / http URL）→ Anthropic `image` block / Gemini `inline_data`；不支持的模型由上游报错并透传。
- 转换器以"尽力映射 + 参数白名单"为原则：temperature、top_p、max_tokens、stop、tools 等主流参数映射；不支持的参数记录到日志并丢弃（可配置是否报错）。

**借鉴 cc-switch proxy 的模块划分**（`src-tauri/src/proxy/`，用 TS 重写对应职责）：

| cc-switch 模块 | 本项目对应 | 职责 |
|----------------|-----------|------|
| `provider_router.rs` | `lib/gateway/router.ts` | model → provider/上游模型名解析 |
| `model_mapper.rs` | 同上 | 别名/映射改写 |
| `handlers.rs` + `handler_context.rs` | `app/api/v1/*` 路由 + `lib/gateway/context.ts` | 各协议入口解析与鉴权 |
| `forwarder.rs` + `sse.rs` | `lib/gateway/forward.ts` | 上游转发、SSE 流处理 |
| `failover_switch.rs` | `lib/gateway/failover.ts` | 别名备选目标按序降级 |
| `circuit_breaker.rs` | `lib/gateway/circuit-breaker.ts`（M7 可选） | 连续失败熔断 |
| `error_mapper.rs` | `lib/gateway/errors.ts` | 上游错误统一映射回入口协议的错误格式 |
| `usage/` | `lib/services/stats.ts` | token 用量提取与记录 |

---

## 4. 技术选型

**推荐方案：Next.js (App Router) 全栈单体**

| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | Next.js 15 + TypeScript | 前端管理后台 + 后端 API 同仓同进程，单人项目运维最简 |
| 数据库 | SQLite（Prisma 或 Drizzle ORM） | 零依赖、单文件、备份即拷贝；数据量极小 |
| 密钥加密 | AES-256-GCM，主密钥来自环境变量 `MASTER_KEY` | 数据库泄露不泄露明文 Key |
| UI | Tailwind CSS + shadcn/ui | 快速搭后台 |
| HTTP 客户端 | undici / 原生 fetch | 转发上游 SSE |
| 鉴权 | 管理后台：无认证（本机/受信网络）；网关：多令牌 `Authorization: Bearer <token>`（sha256 比对，支持启停/过期/限额） | |
| 部署 | 本机 `pnpm start` 或 Docker 单容器 | 自用 |

备选：FastAPI + React（若更熟 Python）。下文以 Next.js 方案展开。

---

## 5. 系统架构

```text
┌─────────────────────────────────────────────────────────┐
│                    Next.js 应用                          │
│                                                         │
│  ┌──────────────┐      ┌────────────────────────────┐   │
│  │ 管理后台 UI   │      │ API 层                      │   │
│  │ (React SPA)  │────► │  /api/admin/*  管理接口     │   │
│  └──────────────┘      │  /v1/*         网关接口     │   │
│                        └──────┬─────────────────────┘   │
│                               │                         │
│        ┌──────────────────────┼──────────────────┐      │
│        ▼                      ▼                  ▼      │
│  ┌───────────┐        ┌──────────────┐    ┌───────────┐ │
│  │ Provider  │        │  Gateway     │    │ Prompt    │ │
│  │ Service   │        │  Router/适配  │    │ Service   │ │
│  └─────┬─────┘        └──────┬───────┘    └─────┬─────┘ │
│        └──────────┬──────────┘                  │       │
│                   ▼                             ▼       │
│              ┌─────────────────────────────────────┐    │
│              │  SQLite (providers/models/prompts/  │    │
│              │  logs/settings)                     │    │
│              └─────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
         ▲ 出站 HTTPS
         │
   各模型服务商 API
```

### 5.1 网关路由逻辑（核心）

1. 客户端请求 `POST /v1/chat/completions`，body 里 `model` 字段取值：
   - 别名（如 `best-coding`）→ 查 alias 表 → 解析为 `provider_id + upstream_model`；
   - 或显式格式 `provider-slug/model-name`（如 `deepseek/deepseek-chat`）；
   - 或全局唯一模型名（自动匹配启用了该模型的服务商，多个则取优先级最高的）。
2. 查 provider：禁用 → 404；解密 api_key。
3. 若请求带 `prompt_id` 或扩展字段 `x-preset`，渲染提示词并注入为 system message（见 §7）。
4. 按 provider.protocol 判断：**入口协议与原生协议一致 → 原生透传**（仅改鉴权与 model 名）；否则选适配器经 IR 双向转换。
5. 上游响应（流式/非流式）→ 转换回入口协议格式 → 返回客户端。
6. 异步写请求日志（含 usage tokens、耗时、状态码、错误摘要）。

---

## 6. 数据模型

```sql
-- 服务商
providers (
  id            TEXT PRIMARY KEY,        -- uuid
  slug          TEXT UNIQUE NOT NULL,    -- deepseek / kimi ...
  name          TEXT NOT NULL,
  protocol      TEXT NOT NULL,           -- 'openai' | 'openai-responses' | 'anthropic' | 'gemini'（服务商原生协议）
  base_url      TEXT NOT NULL,
  api_key_enc   TEXT NOT NULL,           -- AES-GCM 密文
  enabled       INTEGER NOT NULL DEFAULT 1,
  priority      INTEGER NOT NULL DEFAULT 0,  -- 同名模型冲突时优先级
  balance_config TEXT,                   -- JSON: {endpoint, method, json_path, unit} 自定义余额查询
  remark        TEXT,
  created_at    INTEGER, updated_at INTEGER
);

-- 模型（同步或手动添加）
models (
  id            TEXT PRIMARY KEY,
  provider_id   TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_id      TEXT NOT NULL,           -- 上游真实模型名
  alias         TEXT,                    -- 可选别名（全局唯一）
  display_name  TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  input_price REAL, output_price REAL,    -- 每百万 token 单价
  cache_read_price REAL, cache_write_price REAL,
  pricing_source TEXT,                    -- manual / cc-switch-provider / cc-switch-global
  pricing_source_ref TEXT, pricing_synced_at INTEGER,
  context_window INTEGER,
  synced        INTEGER NOT NULL DEFAULT 0,  -- 1=同步来的, 0=手动加的
  UNIQUE(provider_id, model_id)
);

-- 路由别名（虚拟模型 → 实际模型，支持 failover 列表）
route_aliases (
  id         TEXT PRIMARY KEY,
  alias      TEXT UNIQUE NOT NULL,       -- best-coding
  targets    TEXT NOT NULL,              -- JSON: [{provider_id, model_id}, ...] 按序 fallback
  enabled    INTEGER NOT NULL DEFAULT 1
);

-- 预设提示词
prompts (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,      -- code-review
  content     TEXT NOT NULL,             -- 支持 {{var}} 占位
  description TEXT,
  created_at  INTEGER, updated_at INTEGER
);

-- 请求日志
request_logs (
  id           TEXT PRIMARY KEY,
  ts           INTEGER NOT NULL,
  provider_id  TEXT, model_id TEXT, alias TEXT,
  prompt_id    TEXT,
  token_id     TEXT,                     -- 本次调用使用的网关令牌
  client_key TEXT, client_name TEXT,     -- 请求客户端稳定键与写入时名称快照
  entry_protocol TEXT,                   -- 内部协议兼容字段，不作为可见“入口”
  source TEXT,                           -- 清理后的原始 User-Agent
  status       INTEGER,                  -- HTTP 状态
  latency_ms   INTEGER,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  cost         REAL,
  error        TEXT,                     -- 错误摘要（不存请求体全文，避免泄露）
  stream       INTEGER
);
CREATE INDEX idx_logs_ts ON request_logs(ts);

-- 余额查询快照
balance_snapshots (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  raw         TEXT,                      -- 原始返回 JSON
  summary     TEXT                       -- 解析后: "剩余 ¥12.34"
);

-- 网关令牌（多令牌 + 限额）
gateway_tokens (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  key_enc      TEXT NOT NULL,            -- AES-GCM 密文（查看/复制用）
  key_hash     TEXT NOT NULL,            -- sha256(明文)，网关鉴权比对
  prefix       TEXT NOT NULL,            -- 展示用前缀，如 mc-a1b2c3d4
  enabled      INTEGER NOT NULL DEFAULT 1,
  expires_at   INTEGER,                  -- null = 永不过期
  spend_limit  REAL,                     -- 限额金额（按 request_logs.cost 聚合；null = 不限）
  spend_window TEXT,                     -- 'day' | 'week' | 'month' | 'total'
  created_at   INTEGER
);

-- 全局设置（单行）
settings (key TEXT PRIMARY KEY, value TEXT);
-- log_retention_days、allow_http_providers、balance_refresh_seconds 等
```

---

## 7. API 设计

### 7.1 网关接口（对客户端，四协议）

| 方法 | 路径 | 协议 | 说明 |
|------|------|------|------|
| POST | `/v1/chat/completions` | OpenAI Chat | 聊天推理（流/非流、tool calls、多模态）。`model` 支持别名 / `provider/model` / 裸模型名 |
| POST | `/v1/responses` | OpenAI Responses | Responses API 出口（Codex 类客户端）；非原生时经 IR 转换 |
| POST | `/v1/messages` | Anthropic | Anthropic 协议出口，供 Claude Code / agent 直连 |
| POST | `/v1beta/models/{model}:generateContent`、`:streamGenerateContent` | Gemini | Gemini 原生协议出口 |
| GET | `/v1/models` | OpenAI | 返回所有启用模型的聚合列表（id 用别名或 `provider/model` 形式） |

所有入口遵循同一原则：**入口格式与目标服务商原生协议一致时原生透传，否则经 IR 转换**（§3.2）。

鉴权（多令牌体系，令牌在「令牌」页管理）：
- OpenAI 出口：`Authorization: Bearer <token>`；
- Anthropic 出口：`x-api-key: <token>`（兼容 Claude Code 的鉴权头），同时也接受 `Authorization: Bearer`。
- 令牌支持启停、过期时间（过期返回 401 `token_expired`）、花费限额（超限返回 429 `spend_limit_exceeded`；按 request_logs.cost 聚合，未配单价的调用 cost 为 null 不计入限额；窗口 day=本地当天 0 点、week=近 7 天、month=近 30 天、total=累计）。

Claude Code 接入示例：`ANTHROPIC_BASE_URL=http://localhost:3000 ANTHROPIC_AUTH_TOKEN=<token>`。

扩展能力（自定义字段，放在请求体顶层，网关消费后剥离）：

```json
{
  "model": "ds",
  "prompt_id": "code-review",
  "prompt_vars": { "language": "TypeScript" },
  "messages": [{ "role": "user", "content": "..." }]
}
```

提示词渲染：取 `prompts.content`，替换 `{{var}}`，作为**首条 system message** 注入；若 messages 已有 system，则拼接在前（空一行）。引用方式支持 `prompt_id`（按 id）与 `prompt_name`（按 name）二选一；未提供的变量保留 `{{var}}` 原样。三个入口（chat/completions、messages、responses）均支持：原生透传时注入到对应协议的 system 位置（Anthropic 顶层 `system`、Responses 顶层 `instructions`）。

### 7.2 管理接口（对后台 UI，无认证——仅限本机/受信网络）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/admin/providers` | 列表 / 新建 |
| PATCH/DELETE | `/api/admin/providers/:id` | 修改（含启用/禁用）/ 删除 |
| GET | `/api/admin/providers/:id/key` | 查看 api_key 明文（加密存储，按需解密） |
| POST | `/api/admin/providers/:id/test` | 连通性测速（返回延迟与上游状态） |
| POST | `/api/admin/providers/:id/sync-models` | 拉取上游模型列表并合并入库 |
| GET | `/api/admin/providers/:id/balance` | 查询余额/套餐（实时 + 写快照；quota 类型返回 tiers） |
| GET | `/api/admin/balances` | 并发查询所有启用服务商余额/套餐 |
| GET/POST/PATCH/DELETE | `/api/admin/models` | 模型管理、别名设置 |
| GET/POST/PATCH/DELETE | `/api/admin/aliases` | 路由别名管理 |
| GET/POST/PATCH/DELETE | `/api/admin/prompts` | 提示词管理 |
| POST | `/api/admin/prompts/:id/render` | 预览渲染结果 |
| GET/POST | `/api/admin/tokens` | 令牌列表（含窗口已用）/ 创建（明文仅创建时返回一次） |
| PATCH/DELETE | `/api/admin/tokens/:id` | 令牌修改（启停/过期/限额）/ 删除 |
| GET | `/api/admin/tokens/:id/key`、`/usage` | 查看令牌明文 / 窗口内已用金额 |
| GET | `/api/admin/logs?provider=&model=&token=&client=&from=&to=&status=` | 日志查询（分页；入口按请求客户端筛选） |
| POST | `/api/admin/logs/purge` | 手动清理过期日志 |
| GET | `/api/admin/stats?granularity=day` | 用量/成本聚合 |
| GET/PUT | `/api/admin/settings` | 日志保留天数、余额刷新间隔、http provider 开关 |
| GET/POST | `/api/admin/export` / `import` | 配置导入导出（api_key 可选脱敏） |

---

## 8. 余额与套餐查询适配（重点难点）

各服务商差异大，统一抽象为：

```ts
interface BalanceResult {
  supported: boolean;
  type?: 'money' | 'quota';  // money=金额余额（默认）；quota=Coding Plan 套餐配额
  summary?: string;          // "剩余 ¥12.34 / 总额 ¥100" 或 "套餐已用 42%"
  tiers?: QuotaTier[];       // quota 类型：{ name: five_hour|weekly_limit, utilization, resets_at }
  plan?: string;             // 套餐等级（若有）
  raw?: unknown;             // 原始 JSON（存入快照）
  error?: string;
}
```

- CC Switch 内置金额端点按 Base URL 识别：DeepSeek、StepFun、SiliconFlow 中国/国际站、OpenRouter credits、Novita AI；因此同一厂商不同协议变体都可查询。Kimi 余额为本项目原有扩展。自定义 endpoint 支持完整 URL 或 `//path`（origin 级）覆盖。
- `balance_config` 字段允许用户自定义：`{ endpoint, method, headers, json_path, unit }`，应对未内置/接口变更的服务商。
- **Coding Plan 套餐**（移植 cc-switch coding_plan.rs）：按预设 `codingPlan` 标记或 base_url 模式检测（kimi `api.kimi.com/coding`、智谱 `bigmodel.cn`/`api.z.ai`、MiniMax、ZenMux、火山）。返回配额档位（5 小时窗/周限额 + 重置时间），UI 用进度条展示。智谱 Authorization 不加 Bearer 前缀；MiniMax 返回剩余百分比需反转；resetTime 秒/毫秒自适应。火山方舟套餐需控制面 AK/SK 签名（与推理 Key 两套凭据），暂不支持并明确提示。
- 不支持的服务商：返回 `supported: false`，UI 显示"前往控制台"链接。
- 仪表盘/服务商页支持"全部刷新"，并发查询、各自容错、写入 `balance_snapshots` 供历史趋势查看。

---

## 9. 前端页面

1. **仪表盘**：概览卡片（今日请求数/tokens/成本/成功率）、近 14 天用量趋势、按服务商聚合表、各服务商余额卡片。
2. **服务商（含模型管理）**：卡片式列表，卡片头显示 logo、名称、协议徽章、测速延迟徽章、余额（进入页面自动拉取并按 `balance_refresh_seconds` 定时刷新，可单独立即刷新）、Key（掩码 + 查看明文 + 复制）、启停开关、操作；**点击卡片头展开该服务商的模型表格**（同步模型、行内编辑别名/单价、启停、删除、手动添加）；新建服务商保存成功后自动同步一次模型并展开卡片。原独立「模型」页已并入本页，`/models` 重定向到 `/providers`。
3. **路由别名**：别名 → 目标模型列表（上下移动排序实现 failover 顺序）。
4. **提示词**：列表 + 编辑器 + `{{变量}}` 检测 + 实时渲染预览。
5. **令牌**：多网关令牌管理（创建返回明文一次、查看/复制明文、启停、过期时间、限额与窗口已用进度条）。
6. **日志**：筛选（令牌/服务商/请求客户端/状态/时间/错误摘要）+ 高密度表格；“入口”是 Codex、Claude Code、Kimi Code 等请求客户端，“来源”是清理后的真实 User-Agent。`entry_protocol` 仅供内部协议兼容，界面不显示 Chat/Responses/Messages 入口标签。
7. **设置**：令牌页入口、导入导出、日志保留天数、余额刷新间隔、http provider 开关。

---

## 10. 安全要点

- **管理后台无认证**：本平台定位单人本机自用，管理界面与 `/api/admin/*` 无登录鉴权。**仅限本机/受信网络使用**；如需暴露公网，必须在反向代理层加鉴权（Basic Auth / IP 白名单）并强制 HTTPS。
- api_key / 令牌明文一律 AES-256-GCM 加密入库；`MASTER_KEY` 只从环境变量读，不写库不写日志；明文查看走单独按需接口（`Cache-Control: no-store`）。
- 网关令牌只存 sha256 哈希用于比对（`timingSafeEqual`）；令牌支持启停/过期/限额作为第二道防线。
- 日志**不记录**请求体/响应体全文，只记元数据与错误摘要。
- SSRF 防护：provider 的 base_url 允许用户自定义，需校验协议为 https（localhost 始终放行用于本地模型如 Ollama；非 loopback 的 http 需设置页显式开启）。
- 依赖锁定、SQLite 文件权限 600。

---

## 11. 里程碑计划

| 里程碑 | 内容 | 验收标准 |
|--------|------|----------|
| M1 骨架 | 项目脚手架、DB schema、登录、服务商 CRUD（含预设）、加密存储 | 能新增/编辑/启停服务商，Key 加密落库 |
| M2 网关核心 | OpenAI 兼容透传 + 模型解析（别名/provider 前缀）+ 非流式 | curl 经网关调用 DeepSeek 成功 |
| M3 流式 + 适配器 | SSE 透传（含 tool_calls 增量）；Anthropic、Gemini 协议转换（含工具调用与图片输入）；**Anthropic 兼容出口 `/v1/messages`** | 流式逐字输出；Claude、Gemini 经网关可用；Claude Code 指向本网关可正常对话与调工具 |
| M4 提示词 | 提示词 CRUD、`prompt_id` 注入、渲染预览 | 网关请求带 prompt_id 生效 |
| M5 模型与额度 | 模型同步、模型管理、余额查询（内置 + 自定义 json_path） | 仪表盘显示各家余额与模型列表 |
| M6 日志统计 | 请求日志、筛选、用量/成本看板 | 日志可查、统计图正确 |
| M7 完善 | 测速、路由别名 failover、导入导出、Docker 打包、README | 全流程走通，可一键部署 |

---

## 12. 测试策略

- 单元测试：协议适配器（Anthropic/Gemini ↔ OpenAI 的请求与流式 chunk 互转，用录制好的 fixtures）、提示词渲染、模型名解析。
- 集成测试：用 mock 上游（MSW 或本地 HTTP mock）跑网关端到端：路由、流式、错误透传、failover。
- 手工冒烟：M2 起每个里程碑用 curl + 真实 Key 对 2~3 家服务商验证。

---

## 13. 已确认的开放问题

1. ~~是否支持 embeddings / 图片生成等非 chat 端点？~~ **已确认：不支持。** v1 只做文本 + 多模态（视觉输入）chat 模型，面向 coding/agent 场景。
2. 是否部署到公网服务器？影响鉴权与 HTTPS 配置强度。（暂按本机使用设计，公网部署时按 §10 加固）
3. ~~是否需要 Anthropic 反向出口？~~ **已确认：需要。** 对外暴露 `/v1/messages`，供 Claude Code 等 agent 直连（见 F3b、§7.1）。
4. 失败重试策略：同一模型失败时重试几次、是否切换别名下的备选目标？（v1：网关内不自动重试，failover 仅在别名配置了备选目标时触发一次降级；客户端错误原样透传）

---

## 附录 A：Homebrew Node 的 CA 证书问题与内置修复

**症状**：Homebrew 安装的 node@22（shared OpenSSL）在某些机器上系统 CA 存储损坏（`/opt/homebrew/etc/openssl@3/cert.pem` 缺失），导致 Node `fetch` 访问任何 https 站点都报 `self-signed certificate in certificate chain`，表现为测速/余额查询/网关转发全部 `fetch failed`（curl/openssl 正常，因为它们的 CA 路径不同）。

**内置修复**：`instrumentation.ts`（Next.js 启动钩子，`register()` 在 nodejs runtime 执行一次）用 `undici` 的 `setGlobalDispatcher` 把全局 dispatcher 的 CA 显式设为 Node 内置的 Mozilla CA 列表（`tls.rootCertificates`），不再依赖系统 OpenSSL CA 文件。网关转发、测速、余额、模型同步等所有出站 `fetch` 均被覆盖。

**可选的系统级修复**（治本，修好后本项目的内置修复也无副作用）：

```bash
brew install ca-certificates   # 或 brew reinstall ca-certificates
# 确认 /opt/homebrew/etc/openssl@3/cert.pem 存在
```
