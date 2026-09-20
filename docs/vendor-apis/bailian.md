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

## 语音接口（2026-09-20 用真实密钥逐族实测）

**四族，四套协议，没有交集。** 判错了族上游会直接拒：走错 HTTP 端点回
`url error, please check url`，把只有 WebSocket 的模型发去 HTTP 回
`current user api does not support http call`，把只有 HTTP 的模型发去 WebSocket 回
`Model not found`。本项目的路由在 `lib/vendors/bailian/audio.ts` 的
`resolveBailianAudioRoute`。

| 族 | 模型 | 协议与端点 | 状态 |
|---|---|---|---|
| **Qwen-TTS** | `qwen-tts`、`qwen-tts-latest`、`qwen3-tts-flash`、`qwen3-tts-instruct-flash` | HTTP `POST /api/v1/services/aigc/multimodal-generation/generation` | ✅ 已跑通 |
| **同步 ASR** | `qwen3-asr-flash` | 同上 | ✅ 已跑通 |
| **WebSocket TTS** | `sambert-*`、`cosyvoice-*`、`qwen-audio-*-tts` | `wss://{ws}.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference` | ✅ 已跑通（v3.5 除外） |
| **录音文件转写** | `*-filetrans` | HTTP 异步提交 + 轮询 | ✅ 已跑通 |

### Qwen-TTS（HTTP）

```json
{ "model": "qwen3-tts-flash",
  "input": { "text": "…", "voice": "Cherry", "language_type": "Chinese" } }
```

响应 `output.audio.url`（24 小时有效），`usage.characters`。
请求体**不收 `format`**，实测固定返回 WAV——所以响应头要按实际拿到的音频定，不能照抄
客户端请求的 `response_format`。

### 同步 ASR（HTTP）

```json
{ "model": "qwen3-asr-flash",
  "input": { "messages": [{ "role": "user", "content": [{ "audio": "<data URI 或公网 URL>" }] }] } }
```

**不是** OpenAI 的 `{type:'input_audio', input_audio:{data}}`——那个形状属于
`/compatible-mode/v1/chat/completions`，发到这个端点会被拒：
`Input should be a valid string: input.messages.0.content.str`。

base64 data URI 与公网 URL 都实测可用。响应在
`output.choices[0].message.content[0].text`；无语音内容时 `content` 是空数组。

### WebSocket TTS

握手时带 `Authorization: Bearer {key}`。消息序列：

```json
// run-task
{ "header": { "action": "run-task", "task_id": "<uuid>", "streaming": "duplex" },
  "payload": { "task_group": "audio", "task": "tts", "function": "SpeechSynthesizer",
    "model": "cosyvoice-v2",
    "parameters": { "text_type": "PlainText", "voice": "longxiaochun_v2",
                    "format": "mp3", "sample_rate": 22050 },
    "input": {} } }
// task-started 之后：continue-task 送文本，再 finish-task 收尾
```

音频从**二进制帧**回来，控制事件是 JSON：`task-started` / `result-generated` /
`task-finished` / `task-failed`。`finish-task` 不能省，否则尾部合成不出来。

**Sambert 是例外**：`streaming` 用 `"out"` 而不是 `"duplex"`，不支持流式输入，
文本必须随 run-task 一次发完，**也没有 `voice` 参数**——模型名本身就是音色。
用错模式的表现是 `Request text is invalid!`。

**音色表按模型版本分，互换必被拒。** 上游用 `Engine return error code: 418` 表示
「这个音色不属于这个模型」。实测：

| 模型 | 可用音色 | 结果 |
|---|---|---|
| `cosyvoice-v2` | `longxiaochun_v2` | ✅ |
| `cosyvoice-v2` | `longxiaochun_v3` / `Cherry` | ❌ 418 |
| `cosyvoice-v3-flash` | `longanhuan`、`longanyang`、`longanhuan_v3`、`longfeifei_v3`、`longhuhu_v3`、`longxiaochun_v3` | ✅ 全部可用 |
| `cosyvoice-v3.5-flash/plus` | 上述全部 + `Cherry` + 不传 | ❌ 全部 418 |
| `sambert-*` | 不传 | ✅ |
| `qwen-audio-3.0-tts-flash/plus` | `longanlingxi` | ✅ |

`cosyvoice-v3.5` 系列的模型简介写着「对**声音克隆和声音设计**的语音合成效果进行
全面升级」，而所有预置音色都 418——**推断**它需要先创建克隆音色再用其 ID 作 voice。
**未核实**：没有实际创建过克隆音色验证。网关在 418 时会把这条推断作为提示附在错误里。

`qwen-audio-3.1-tts-flash` 回 `Engine error [411]: TTS speak operation failed`，
**未核实**原因。

### 录音文件转写（异步）

```
POST /api/v1/services/audio/asr/transcription
     X-DashScope-Async: enable          ← 缺这个头会被当同步调用
     { "model": "qwen3-asr-flash-filetrans", "input": { "file_url": "…" } }
  → { "output": { "task_id": "…" } }

GET  /api/v1/tasks/{task_id}
  → { "output": { "task_status": "SUCCEEDED",
                  "result": { "transcription_url": "…" } } }

GET  {transcription_url}   ← 文本在这里，不在轮询响应里
  → { "transcripts": [{ "channel_id": 0, "text": "…", "sentences": [...] }] }
```

`task_status` 取值 `SUCCEEDED` / `FAILED` / 运行中。结果 URL 24 小时有效。
**只接受公网可访问的 URL，不收 base64**——这是接口本身的限制。网关没有对象存储
替客户端上传，所以 `/v1/audio/transcriptions` 对这类模型要求传 `file_url` 字段
而不是 `file`。

### 仍然不可用的

| 模型 | 上游回应 | 处理 |
|---|---|---|
| `*-realtime` | WebSocket 端点上 `Model not found` | 本地 400；它们用另一套实时协议，网关未实现 |
| `cosyvoice-v3.5-*` | `418` | 放行到上游，附上音色不匹配的提示 |
| `qwen-audio-3.1-tts-flash` | `Engine error [411]` | 放行到上游，原样回传 |
| `qwen-audio-3.0-asr-flash` | `400 {}`（空错误体） | 放行到上游，原样回传 |

### 计价口径：语音不是按 token 计价

这解释了为什么语音请求的成本列是空的——不是漏了，是不适用：

| 模型 | 官方计价 |
|---|---|
| `qwen3-tts-flash`、`cosyvoice-*` | `cosy_tts_number` ¥0.8 **每万字符** |
| `qwen3-asr-flash` | `content_duration` ¥0.00022 **每秒** |
| `qwen-tts` | `text_input_token` ¥1.6/百万 + `qwen_tts_multi_output_token` ¥10/百万 |

`models` 的扁平价列是「每百万 tokens」口径，装不下前两种，所以为空；阶梯原文完整
保存在 `pricing_tiers_json` 里。上游给的是 `usage.characters`（TTS）与
`usage.seconds` / `audio_tokens`（ASR），都不是扁平列能直接相乘的东西，因此日志的
`usage` 留空、成本显示「—」，而不是编一个对不上账的数字。

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
