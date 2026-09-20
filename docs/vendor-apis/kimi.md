# Kimi / 月之暗面

文档站：https://platform.kimi.com/docs
核对日期：2026-09-19（文档核对，未用真实工具密钥发起调用）

## 凭据分层（踩过的坑）

三套互不通用的密钥：

| 密钥 | 来源 | 能用的接口 |
|---|---|---|
| Kimi 平台密钥 | platform.kimi.com | 推理、工具、余额、模型列表（`api.moonshot.cn`） |
| Kimi 国际站密钥 | platform.kimi.ai | 同上，但域名不同 |
| Kimi For Coding 套餐密钥 | 套餐订阅 | `api.kimi.com/coding/v1` 的推理 |

> 官方原文：「API keys from domestic (`platform.kimi.com`) and international (`platform.kimi.ai`) platforms are completely separate; mixing them produces 401 errors.」

**本项目现状**：`lib/vendors/balance.ts` 的 `kimi` 解析器按 `${base}/users/me/balance` 拼接，而用户配置的 Kimi 服务商 base 是 `https://api.kimi.com/coding/v1`，拼出来是 `https://api.kimi.com/coding/v1/users/me/balance`——与官方文档的 `https://api.moonshot.cn/v1/users/me/balance` 不是同一个主机。**尚未用真实密钥验证哪个对**，改之前需要先验证。

## 工具接口

全部 `POST`，`Authorization: Bearer {MOONSHOT_API_KEY}`，主机 `https://api.moonshot.cn`。

### 联网搜索 `/v1/tools/search`
- 文档：https://platform.kimi.com/docs/api/tools-search
- 入参：`text_query`（必填）、`limit`（1–20，默认 5）、`timeout_seconds`（1–60）、`include_content`（默认 false）
- 出参：`search_results[]`，每项含 `title / url / snippet / text / site_name / date / authority / icon / mime`
- 响应头：`X-Msh-Track-Id`、`X-Msh-Chat-Id`
- **计费：¥0.01 / 次**

### 联网搜索 Pro `/v1/tools/search_pro`
- 文档：https://platform.kimi.com/docs/api/tools-search-pro
- 比基础版多：`sites`（最多 5 个域名，OR 逻辑）、`time_window`（`start`/`end`，支持 `YYYY` / `YYYY-MM` / `YYYY-MM-DD`）
- 出参多 `chunks[]`（`text` + `score` 相关度分片）
- **计费：¥0.015 / 次**

### 网页抓取 `/v1/tools/fetch`
- 文档：https://platform.kimi.com/docs/api/tools-fetch
- 入参：`url`（必填，仅 http/https）
- 出参：`{ url, markdown, title }`
- **计费：¥0.01 / 次**

### 计费口径（三个工具统一）

> 搜索：「请求成功（HTTP 200）且 `search_results` 非空时，计费一次；请求失败或未返回结果时不计费。」
> 抓取：「请求成功（HTTP 200）且返回的 `markdown` 非空白时，计费一次；请求失败或页面无正文内容时不计费。」

价格页：https://platform.kimi.com/docs/pricing/websearch

## 余额 `GET /v1/users/me/balance`

文档：https://platform.kimi.com/docs/api/balance
主机：`https://api.moonshot.cn`

```json
{
    "code": 0,
    "data": {
        "available_balance": 49.58894,
        "voucher_balance": 46.58893,
        "cash_balance": 3.00001
    },
    "scode": "0x0",
    "status": true
}
```

| 字段 | 含义 |
|---|---|
| `data.available_balance` | 可用余额（人民币）。**≤ 0 时推理接口返回 `exceeded_current_quota_error`** |
| `data.voucher_balance` | 代金券余额，非负 |
| `data.cash_balance` | 现金余额，**可为负**（欠费） |

## 模型列表 `GET /v1/models`

文档：https://platform.kimi.com/docs/api/list-models
**已用真实密钥核对**（`https://api.kimi.com/coding/v1/models`，2026-09-19）。

> 用户确认：**Coding 套餐站与平台站的模型详情接口可以通用**，出现的模型一致时没有差别，
> 差异只在 Coding 站多出 `-highspeed` 变体。因此一个解析器同时服务两边。

**实测返回的字段比文档还多**（文档只列了前 7 个）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 模型 ID，如 `kimi-k3` |
| `object` | string | 固定 `"model"` |
| `created` / `created_at` | integer / string | 创建时间 |
| `owned_by` | string | 如 `"moonshot"` |
| `display_name` | string | 展示名，如 `K2.8 Preview` |
| `context_length` | integer | 最大上下文（tokens） |
| `supports_image_in` | boolean | 图片输入 |
| `supports_video_in` | boolean | 视频输入 |
| `supports_reasoning` | boolean | 深度思考 |
| **`supports_dynamic_tools`** | boolean | **工具调用**（文档未列） |
| **`supports_thinking_type`** | string | 如 `"only"`（文档未列） |
| **`think_efforts`** | object | `{ support, valid_efforts[], default_effort }`（文档未列） |

**没有**返回价格与最大输出长度。无分页，一次返回全部。

实测样例（节选）：

```json
{ "id": "kimi-for-coding", "display_name": "K2.8 Preview",
  "context_length": 1048576,
  "supports_reasoning": true, "supports_image_in": true, "supports_video_in": true,
  "supports_dynamic_tools": true, "supports_thinking_type": "only",
  "think_efforts": { "support": true, "valid_efforts": ["low","high","max"], "default_effort": "max" } }
```

### 本项目的落地

`lib/vendors/kimi/catalog.ts`，按 Base URL 主机判定（`api.moonshot.cn` / `api.moonshot.ai` / `api.kimi.com` / `api.kimi.ai`），不按 slug。

映射：
- `supports_image_in` → `vision`；`supports_dynamic_tools` → `tools`；`supports_reasoning` → `reasoning`
- 视频没有对应的能力位，和图片一起进 `modalities`（`Text` / `Image` / `Video`）
- `think_efforts` → `models.reasoning_json`（`{ efforts, defaultEffort, control: 'level' }`），
  `support !== true` 或档位枚举对不上时**整条不写**，不塞半套
- 上游没给的布尔位**不写**，解析时判为「未知」而不是「不支持」
- 原始 flags 存进 `capabilities_json.rawKimiFlags`，便于日后对照字段变化

`-highspeed` 变体在响应里是**独立条目、自带能力字段**，不需要剥后缀继承基础模型。
实测它 `supports_dynamic_tools: false` 且没有 `think_efforts`——与基础模型确实不同。

### 顺带修掉的一处错误数据

`lib/services/model-capabilities.ts` 的 `EXACT_MODEL_SPECS` 原本手工写了 Kimi 四条 + Moonshot 三条，其中：
- `k3` 记 `contextWindow: 256_000`，上游实际 **1048576**
- `kimi-for-coding-highspeed` 记 `tools: true`，上游实际 **false**

已全部删除——有活的官方目录就不该再留一份会过期的手工字典。
