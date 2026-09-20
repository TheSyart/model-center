# 阿里云百炼 / Model Studio

文档站：https://help.aliyun.com/zh/model-studio/
官方 CLI 技能包原件：[`_sources/bailian-cli/`](_sources/bailian-cli/)（用户提供，25 个文件）
核对日期：2026-09-20（模型目录、价格与**语音接口**已用真实密钥核对；其余为文档核对）

## 鉴权分层——这是百炼最容易踩的坑

`_sources/bailian-cli/reference/auth.md` 显示三套可并存的凭据：

| 凭据 | 获取方式 | 能做什么 |
|---|---|---|
| **API Key**（`sk-…`） | 控制台 | 推理、模型目录、模型限流（QPM/TPM） |
| **Console**（浏览器登录票据） | `bl auth login --console` | 套餐用量、免费额度、用量统计、限流使用率 |
| **OpenAPI AK/SK**（`LTAI…`） | 阿里云 AccessKey | Token Plan 席位管理 |

各命令的鉴权要求（摘自自动生成的 reference，比 SKILL.md 的表格准确）：

| 命令 | 鉴权 | 我们能不能用 |
|---|---|---|
| `bl model list` | **No Auth**（reference 明写「Both the catalog and --enrich parameter-schema endpoints are public」） | 能 |
| `bl quota list` | API Key | 能——但返回的是 QPM/TPM **限流**，不是余额 |
| `bl usage coding-plan` / `token-plan` / `free` / `stats` / `summary` | **Console** | **不能** |
| `bl quota check` / `history` | **Console** | **不能** |
| `bl token-plan harness-quota` | **Console** | **不能** |
| `bl token-plan list-seats` / `create-key` / `assign-seats` | AK/SK | 能（仅席位管理） |

> **结论：百炼的余额与套餐用量拿不到。** Console 是浏览器登录态 + 未公开的内部 RPC 网关（接口名形如 `zeldaEasy.bailian-commerce.freeTrial.queryFreeTierQuota`），网关地址在官方材料里没有出现。唯一服务端可达的额度信号是 AK/SK 的 `GetSubscriptionSeatDetails`（见下）。

### AK/SK 可达的席位额度（未实现）

来自调研 `modelstudioai/cli` 源码，**未用真实 AK/SK 验证**：

- Action `GetSubscriptionSeatDetails`，version `2026-02-10`
- `GET https://modelstudio.cn-beijing.aliyuncs.com/tokenplan/subscription/seat-detail`（国际站 `modelstudio.ap-southeast-1.aliyuncs.com`）
- 签名 ACS3-HMAC-SHA256
- 响应 `Data.Items[].EquityList[]` 含 `CycleTotalValue` / `CycleSurplusValue` / `CycleEndTime`——这是真正的套餐额度窗口
- **未验证**：`CycleTotalValue` 的单位（token？额度？人民币？）、`Cycle*Time` 的纪元单位、所需 RAM 权限

## 模型目录 `GET /api/v1/models`

**已用真实密钥核对**（workspace `llm-a5kyboh5x4q9inqe`，2026-09-19）。

地域主机（本项目只实现了北京）：

| 地域 | URL |
|---|---|
| 北京 | `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/models` |
| 新加坡 | `https://dashscope-intl.aliyuncs.com/api/v1/models` |
| 中国香港 | `https://cn-hongkong.dashscope.aliyuncs.com/api/v1/models` |
| 东京 / 法兰克福 / 弗吉尼亚 | `https://{WorkspaceId}.{ap-northeast-1\|eu-central-1\|us-east-1}.maas.aliyuncs.com/api/v1/models` |

鉴权 `Authorization: Bearer {DASHSCOPE_API_KEY}`。**模型目录地址与推理 Base URL 是两回事**，不要在 `/compatible-mode/v1` 后面接 `/api/v1/models`。

筛选参数全部走 Query String，**数组用重复键**（`capabilities=TG&capabilities=Reasoning`），不能逗号拼接。实测有效：

| 筛选 | 返回总数 |
|---|---|
| 无 | 505 |
| `providers=deepseek` | 26 |
| `capabilities=ASR` | 23 |

枚举值：
- `providers`：`qwen` `zhipu-ai` `wan` `qwen-domain-model` `mini-max` `moonshot-ai` `deepseek` `happyhorse` `kling` `pixverse` `vidu` `tripo` `xiaomi`
- `capabilities`：`TG` `Reasoning` `VU` `IG` `VG` `ASR` `TTS` `ME` `TR` `Realtime-Omni` `Multimodal-Omni` `Realtime-Text-to-Speech` `Realtime-ASR` `Realtime-Audio-Translate` `3D-generation` `Realtime-Chatting`
- `features`：`model-experience` `function-calling` `structured-outputs` `web-search` `prefix-completion` `cache` `batch` `fine-tuning`
- `inference_providers`：`aliyun-bailian` `alibaba-cloud-modelstudio` `siliconflow` `moonshot` `mini-max` `kling` `vidu` `pixverse` `vanchin` `xiaomi` `zhipu-ai` `tripo`
- `service_site`：`global` `international` `asia-pacific-china` `cn-hongkong` `european-union` `united-states` `japan`

### `prices[]` 的真实结构（此前文档标记为待核实）

```json
[{
  "range_name": "Default",
  "prices": [
    { "type": "input_token",       "price": "2.1",  "price_unit": "每百万tokens", "price_name": "输入",           "time_band": "standard" },
    { "type": "output_token",      "price": "8.4",  "price_unit": "每百万tokens", "price_name": "输出",           "time_band": "standard" },
    { "type": "input_token_cache", "price": "0.42", "price_unit": "每百万tokens", "price_name": "输入（缓存命中）", "time_band": "standard" }
  ]
}]
```

三点与此前的假设不同：

1. **是「档位 → 计费项」两层嵌套**，不是扁平列表。
2. **单位给了**（`price_unit`），不需要猜。`每百万tokens` 正好是本项目价格列的口径。
3. **缓存读取的 type 是 `input_token_cache`**——`docs/cc-switch-sync.md` 此前记作「枚举未知」，现已确认。

**币种仍然没有字段。** 判定为人民币的依据：单位串是中文，且数值与官网人民币标价一致（MiniMax-M2.1 输入 ¥2.1 / 输出 ¥8.4）。实现里按 `price_unit` 是否为中文单位来推断，写在 `lib/services/model-sync.ts` 的 `BAILIAN_PRICE_UNITS`。

**本项目的处理规则**（`parseBailianPrices`）：
- 原始 `prices[]` 逐字存进 `models.pricing_tiers_json`
- **单档**且单位可识别 → 折算进扁平价格列，`pricing_currency='CNY'`
- **多档**（如 `Default` + `32k<Input<=128k`）→ 只留存阶梯，不给扁平价。一次请求适用哪档取决于实际输入长度，挑任一档都会算错
- `time_band` 非 `standard`（优惠时段）→ 不当常价
- 未识别的 `type`（`image_number` 等）→ 只留存，不映射

### 其它响应字段

`model` / `name` / `description` / `provider`（模型作者）/ `inference_provider`（供给渠道）/ `capabilities[]` / `features[]` / `inference_metadata.{request_modality,response_modality}` / `model_info.{context_window,max_input_tokens,max_output_tokens,max_reasoning_tokens,reasoning_max_input_tokens,reasoning_max_output_tokens}` / `published_time` / `equivalent_snapshot`

本项目把展示类字段与 token 上限一并存进 `models.capabilities_json`。

## 语音接口（本项目的实现是坏的，2026-09-20 实测）

`lib/vendors/bailian/audio.ts` 把**所有** TTS 模型指向 `SpeechSynthesizer`、所有 ASR 模型指向
`multimodal-generation/generation`。用真实密钥（workspace `llm-a5kyboh5x4q9inqe`）逐族实测，
**没有一个模型能跑通**：

| 模型族 | 实测样本 | 上游返回 |
|---|---|---|
| `qwen-tts` / `qwen3-tts-*` | `qwen-tts`、`qwen3-tts-flash` | `InvalidParameter: url error, please check url` |
| `sambert-*` | `sambert-zhichu-v1` | `InvalidParameter: current user api does not support http call` |
| `cosyvoice-*` | `cosyvoice-v3.5-flash` | `InvalidParameter: [cosyvoice:]Engine return error code: 418` |
| ASR | `qwen3-asr-flash-2026-02-10` | `InternalError.Algo.InvalidParameter: Input should be a valid string: input.messages.0.content…` |

三条不同的结论：

1. **Qwen-TTS 系列的端点不是 `SpeechSynthesizer`。** `url error` 是「这个模型不在这个端点上」，
   多半应走多模态生成端点，但**未验证**，不要照猜的改。
2. **Sambert 只支持 WebSocket。** `does not support http call` 说得很直接，HTTP 这条路走不通。
3. **ASR 的请求体结构不对。** 上游明确指出 `input.messages[0].content` 的类型不符合预期，
   `callBailianAsr` 构造的多模态 messages 与实际契约有出入。

**未核实**：各族正确的端点与请求体。修之前必须先拿官方文档逐族确认，别按错误信息猜。

参考：https://help.aliyun.com/zh/model-studio/error-code#error-url

> 网关侧的安全性与记账已经是对的（准入守卫、令牌限额、抓包、超时、上游状态码透传、不编造成本），
> 坏的只是与上游的契约本身。见 `lib/gateway/modality-pipeline.ts`。

## 模型限流 `GET /api/v1/models/limits`（未实现）

`bl quota list` 用的接口，**现有 API Key 即可**。返回 `output.quotas[].{model, workspace_id, model_limit, workspace_limit}`，每项含 `request_limit` / `request_limit_period` / `usage_limit` / `usage_limit_field` / `usage_limit_period` / `async_user_queue_limit` / `async_user_concurrency_limit`。

**这是限流不是余额**，界面上不能混着展示。

## 工具

百炼的工具**不是独立接口**，需随推理请求在对应协议面下发。控制台列出的 8 项：

| 工具 | 协议面 | 计费 |
|---|---|---|
| Code Interpreter | Responses API | 限时免费 |
| Web Extractor | Responses API | 限时免费 |
| Web Search | Responses API | ¥4 / 千次 |
| I2i Search | Responses API | ¥48 / 千次 |
| T2i Search | Responses API | ¥24 / 千次 |
| Pdf Parsing | Completions API | ¥0.02 / 页 |
| Web Fetch | Anthropic API | 限时免费 |
| Web Search | Anthropic API | ¥4 / 千次 |

来源：用户提供的百炼控制台工具列表（2026-09-18）。PDF 解析另见 https://help.aliyun.com/zh/model-studio/pdf-understanding ——解析出的文字与图片另按模型输入 token 计价。

## 账单 `GET /modelstudio/billing/overview`（未实现，契约待核实）

`docs/cc-switch-sync.md` 记录了参数与响应结构，但**服务 Host、鉴权方式、`groupBy`/`filter` 的线上序列化形式均未确认**。且月度账单不是余额，订阅费用也不是套餐额度，不要混用。
