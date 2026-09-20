# 已确认「没有」的厂商

这份是**否定结论**，用来防止重复调研。下次有人想加某家的余额或能力接口之前，先看这里查过没有。

核对日期：2026-09-18（余额与能力）

## 能力元数据

调研方式：实地打接口（标「实测」）或读官方文档（标「文档」）。

### 有真实能力字段的（4 家 + Kimi，共 5 家）

| 厂商 | 接口 | 字段 | 来源 |
|---|---|---|---|
| **OpenRouter** | `GET https://openrouter.ai/api/v1/models`（**公开免密钥**） | `architecture.{input_modalities,output_modalities,tokenizer}`、`supported_parameters[]`（含 `tools` 376、`reasoning` 313、`web_search_options` 19）、`reasoning.{mandatory,supported_efforts,default_effort}`、`context_length`、`top_provider`、`pricing.*` | 实测，445 个模型 |
| **Novita** | `GET https://api.novita.ai/v3/openai/models`（**公开免密钥**） | `features[]`（`function-calling`/`structured-outputs`/`reasoning`/`serverless`）、`input_modalities`/`output_modalities`、`context_size`、`max_output_tokens`、`endpoints[]`、`pricing.*`、`is_tiered_billing` | 实测，120 个模型 |
| **PPIO** | `GET https://api.ppinfra.com/v3/openai/models`（**公开免密钥**） | 与 Novita **字节级同构**（同一套产品） | 实测，86 个模型，16 个分层计费 |
| **百炼** | `GET {ws}.cn-beijing.maas.aliyuncs.com/api/v1/models` | 见 [`bailian.md`](bailian.md) | 实测 |
| **Kimi** | `GET https://api.moonshot.cn/v1/models` | `context_length`、`supports_image_in`、`supports_video_in`、`supports_reasoning` | 文档，见 [`kimi.md`](kimi.md) |
| Gemini（协议） | `GET {base}/v1beta/models`（**现有同步已在拉**） | `inputTokenLimit`、`outputTokenLimit`、`supportedGenerationMethods[]`、`thinking` | 文档，未用密钥验证 |

### 确认什么都没有的

`/v1/models` 只返回 OpenAI/Anthropic 裸结构，**没有能力、没有价格**：

| 厂商 | 返回 | 来源 |
|---|---|---|
| SiliconFlow | `{id, object, created, owned_by}`。注意 `sub_type` 是**查询过滤参数**，不是响应字段 | 文档 |
| ModelScope（魔搭） | `{id, object, owned_by, created}` | 实测 |
| NVIDIA NIM | `{id, object, created, owned_by}` | 实测 |
| DeepSeek | 裸结构 | 文档 + 探测 |
| 智谱 | 裸结构 | 文档 |
| Anthropic | `{id, type, display_name, created_at}` —— 只有显示名 | 文档 |
| Together AI | 有 `type`/`display_name`/`organization`/`context_length`/`pricing`，但**没有 tools/vision/reasoning 标志**，且文档未说明价格单位与币种 | 文档 |

## 余额查询

调研方式：交叉核对四处独立实现 —— cc-switch `main`、`songquanpeng/one-api`、`Calcium-Ion/new-api`、各家官方文档。

### 已支持（7 家）

DeepSeek、StepFun、SiliconFlow 中国站、SiliconFlow 国际站、OpenRouter、Novita —— 这 6 家来自 cc-switch 固定快照；Kimi 是本项目自加。
实现见 `lib/vendors/balance.ts` 的 `BUILTIN_PARSERS`。

> **上游没有新增。** cc-switch `main`（`06082e18`）的 `detect_provider` 仍然只有那 6 家；`one-api`/`new-api` 相比之下只多一个 Moonshot，而我们已经有了。

### 确认无公开余额接口

| 厂商 | 排查结论 |
|---|---|
| **智谱** | 官方文档与三套开源实现里都没有余额接口。只有 Coding Plan 额度（已实现） |
| **MiniMax** | 官方 API 概览只有语言/视频/语音/图像/音乐/文件，明确没有账户余额、配额、用量或账单接口。只有 Coding Plan 额度（已实现） |
| **ModelScope** | `/v1/user/info` **实测返回 `404 page not found`**。免费额度制 |
| **Together AI** | `api.together.xyz/v1/account/balance` **实测返回 HTML 页面外壳**，不是 API 路由。三套开源实现里也没有 |
| **NVIDIA NIM** | 额度是 NGC / 控制台概念，无 API |
| **百炼** | 见 [`bailian.md`](bailian.md) —— 需 Console 浏览器票据，服务端拿不到 |

### 唯一悬而未决：PPIO

- `GET https://api.ppinfra.com/v3/user` 不带密钥 → `{"code":400,"reason":"MISSING_API_KEY"}`
- 乱写的路由 `/v3/definitely-not-a-route` → 纯文本 `404 page not found`

说明 `/v3/user` 路由族**确实存在且需要鉴权**。但**无法确认 `/v3/user/balance` 这个具体路径**——鉴权中间件在路由之前触发，`/v3/user/balance` 和 `/v3/user/bogus` 返回一模一样的 400。

PPIO 与 Novita 是同一套产品（模型目录字节级同构、错误信封一致），而 Novita 的 `/v3/user/balance` 返回 `{availableBalance}`（单位 1/10000 美元）已实现。**但不要照着类比硬写一个解析器**——等有真实 PPIO 密钥打一次确认后再加。

在此之前，PPIO 可以用 `providers.balance_config` 零代码兜底：

```json
{ "endpoint": "//v3/user/balance", "method": "GET", "json_path": "availableBalance", "unit": "$" }
```

## 套餐额度（Coding Plan）

已实现 5 家：Kimi、智谱（个人版 / 团队版同 Base URL 无法自动区分）、MiniMax 国内站、MiniMax 国际站、ZenMux。
明确拒绝 1 家：**火山方舟**——需控制面 AK/SK 签名，与推理 Key 是两套凭据。
见 `lib/vendors/coding-plan.ts`。
