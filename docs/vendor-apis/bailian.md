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

**六族，六套契约，互不相通。** 判错了族上游会直接拒，而且拒得很不友好——
见下文每一处「会骗人的地方」。本项目的路由在 `lib/vendors/bailian/audio.ts`
的 `resolveBailianAudioRoute`。

| 族 | 模型 | 协议与端点 | 本项目状态 |
|---|---|---|---|
| **Qwen-TTS** | `qwen-tts`、`qwen3-tts-flash`、`qwen3-tts-instruct-flash` | HTTP `POST /api/v1/services/aigc/multimodal-generation/generation` | ✅ 11 个 |
| **WebSocket TTS（协议 A）** | `sambert-*`、`cosyvoice-*`、`qwen-audio-*-tts` | `wss://{host}/api-ws/v1/inference` | ✅ 48 个 |
| **Realtime TTS（协议 B）** | `qwen3-tts-*-realtime` | `wss://{host}/api-ws/v1/realtime?model=…` | ✅ 9 个 |
| **同步 ASR** | `qwen3-asr-flash`、`qwen-audio-3.0-asr-flash` | HTTP 多模态生成端点 | ✅ 2 个 |
| **录音文件转写** | `*-filetrans` | HTTP 异步提交 + 轮询 | ✅ 3 个 |
| **实时 ASR** | `*-asr-*-realtime` | 双向 WebSocket | ❌ 1 个，HTTP 面承载不了 |

### ⚠️ workspace 专有域名会吞掉错误信息

配了 workspace 的服务商走 `https://{ws}.cn-beijing.maas.aliyuncs.com`，
**这条路上的 4xx 错误体常常是空的 `{}`**。同一个请求换公共域名
`https://dashscope.aliyuncs.com` 才说得出真正的原因。

实测两例：`qwen-audio-3.0-asr-flash` 缺 `parameters.format` 时，workspace 域名
回 `400 {}`，公共域名回 `UNSUPPORTED_FORMAT format is empty`；声音设计缺
`preview_text` 时同理。**排查任何空 400，第一步就是换公共域名重打一次。**

### 同步 ASR（HTTP）

```json
{ "model": "qwen3-asr-flash",
  "input": { "messages": [{ "role": "user", "content": [{ "audio": "<data URI 或公网 URL>" }] }] },
  "parameters": { … } }
```

音频形状**不是** OpenAI 的 `{type:'input_audio', input_audio:{data}}`——那个属于
`/compatible-mode/v1/chat/completions`，发到这个端点会被拒：
`Input should be a valid string: input.messages.0.content.str`。

**`parameters` 分两套，且永远要发：**

| | `qwen3-asr-*` | 其余（`qwen-audio-3.x-asr-*`、`fun-asr`、`paraformer`） |
|---|---|---|
| 参数 | `asr_options: { language, enable_lid }` | `format`（**必填**）、`sample_rate`、`vocabulary`、`vocabulary_id`、`language_hints` |
| 热词 | **不支持**（官方规格表「热词」= 否；实测传了不报错也不生效） | ✅ `vocabulary` 形如 `{"小单": 5}`，权重 1–5，50 为超权重 |

`format` 缺了就是上面那个空 400。闭环实测：同一段音频，
`qwen-audio-3.0-asr-flash` 不带 vocabulary 出「小丹」，带上出「小单」。

**上下文消息的角色必须是 `system`。** 传 `user` 会被拒：
`The dedicated task 'asr' corresponding to the current service does not support
this input.`——这正是 OpenAI 标准的 `prompt` 字段此前在网关上 400 的原因。
但要注意：**system 上下文对专名不起作用**，实测重复三次都仍是「小丹」。
要热词就得换到支持 `vocabulary` 的那一族。

识别结果有三种形状，都要兜：`output.choices[0].message.content`（数组或字符串）、
`output.sentence.text`、`output.text`。

### 录音文件转写（异步）

```
POST /api/v1/services/audio/asr/transcription
     X-DashScope-Async: enable          ← 缺这个头会被当同步调用
  → { "output": { "task_id": "…" } }

GET  /api/v1/tasks/{task_id}
  → { "output": { "task_status": "SUCCEEDED", "result": { "transcription_url": "…" } } }

GET  {transcription_url}   ← 文本在这里，不在轮询响应里
  → { "transcripts": [{ "channel_id": 0, "text": "…", "sentences": [...] }] }
```

**输入字段名按族不同，互换均失败，且错误信息看不出是字段名的问题：**

| 模型 | 字段 | 传错时上游回 |
|---|---|---|
| `qwen3-asr-flash-filetrans` | `input.file_url`（单数字符串） | `InvalidParameter.MalformedURL` |
| `qwen-audio-3.0-asr-flash-filetrans` | `input.file_urls`（复数数组） | `InvalidParameter.ParseError` |

**只接受公网可访问的 URL，不收 base64**——这是接口本身的限制。网关没有对象存储
替客户端上传，所以 `/v1/audio/transcriptions` 对这类模型要求传 `file_url` 字段。

### Qwen-TTS（HTTP）

```json
{ "model": "qwen3-tts-flash",
  "input": { "text": "…", "voice": "Cherry", "language_type": "Chinese" } }
```

响应 `output.audio.url`（24 小时有效），`usage.characters`。
请求体**不收 `format`**，实测固定返回 WAV——响应头要按实际拿到的音频定，
不能照抄客户端请求的 `response_format`。也因此它**没有增量音频源**，
网关对它的流式请求是「缓冲后单片下发」，用 `X-Model-Center-Stream: buffered` 标明。

### 两套流式协议，模型名与端点严格绑定

| | 协议 A `run-task` | 协议 B `Realtime` |
|---|---|---|
| 端点 | `/api-ws/v1/inference` | `/api-ws/v1/realtime?model=…` |
| 模型 | **不带** `-realtime` | **必须带** `-realtime` |
| model 传在哪 | 消息体 `payload.model` | **URL query** |
| 音频载体 | 二进制帧 | JSON 文本帧里的 base64 |
| 参数名 | `format` / `rate` / `pitch` / `instruction` | `response_format` / `speech_rate` / `pitch_rate` / `instructions` |

交叉实测：`qwen3-tts-flash-realtime` 在协议 A 上是 `Model not found`；
`qwen-audio-3.0-tts-flash` 在协议 B 上完全不出音；`qwen3-tts-flash`（不带后缀）
在协议 B 上会落进 omni 对话模式，出一点二进制却没有正常事件流。

⚠️ **不要做隐式模型替换。** 自定义音色绑定创建时的 `target_model`，
把 `qwen3-tts-flash` 换成 `-realtime` 会让已复刻的音色全部失效。

#### 协议 A · run-task

```json
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

**Sambert 是例外**：`streaming` 用 `"out"`，不支持流式输入，文本必须随 run-task
一次发完，**也没有 `voice` 参数**——模型名本身就是音色。用错模式的表现是
`Request text is invalid!`。

#### 协议 B · Realtime

```json
// 连上后服务端先推 {"type":"session.created"}
{ "type": "session.update", "session": { "voice": "Cherry", "response_format": "pcm",
                                          "sample_rate": 24000, "mode": "server_commit" } }
{ "type": "input_text_buffer.append", "text": "…" }
{ "type": "input_text_buffer.commit" }
{ "type": "session.finish" }
```

实测事件序列：`session.created` → `session.updated` →
`input_text_buffer.committed` → `response.created` → `response.output_item.added` →
`response.content_part.added` → `response.audio.delta` → `response.audio.done` →
`response.content_part.done` → `response.output_item.done` → `response.done` →
`session.finished`。公共域名与 workspace 专有域名都可用。

⚠️ **两个会骗人的地方：**

1. **建连时根本不校验模型名。** 拿「不存在的模型xyz」去连，照样回
   `session.created`，然后一声不响地关掉。唯一可靠的信号是有没有音频回来。
2. **`response.audio.done` 不是终止事件**，一次会话可以有多轮；只有
   `session.finished` 才是终点。认错了会在第一个句子边界处截断。

### 音色表按模型版本分，互换必被拒

上游用 `Engine return error code: 418`（cosyvoice 系）或 `Engine error [411]`
（qwen-audio 系）表示「这个音色不属于这个模型」。实测：

| 模型 | 可用音色 | 结果 |
|---|---|---|
| `cosyvoice-v2` | `longxiaochun_v2` | ✅ |
| `cosyvoice-v2` | `longxiaochun_v3` / `Cherry` | ❌ 418 |
| `cosyvoice-v3-flash` | `longanhuan`、`longanyang`、`*_v3` 那一套 | ✅ |
| `cosyvoice-v3.5-flash/plus` | 全部预置音色 + 不传 | ❌ 418，**只收克隆音色** |
| `sambert-*` | 不传 | ✅ |
| `qwen-audio-3.0-tts-flash/plus` | **只有 `longanlingxi`**（20 个候选逐个实打），连不传都被拒 | ✅ |
| `qwen-audio-3.1-tts-flash` | 全部预置音色 + 不传 | ❌ 411，**只收克隆音色** |
| `qwen3-tts-*` | `Cherry`、`Ethan`、`Serena`、`Dylan` 等 | ✅ |

`cosyvoice-v3.5-*` 与 `qwen-audio-3.1-tts-flash` 的「只收克隆音色」**已实际验证**：
建一个克隆音色、等 `status` 变 `OK`、再合成，分别出音 57351 与 59859 字节。

⚠️ **音色未就绪时合成会安静地返回空。** `status` 还是 `DEPLOYING` 时，上游会回
`task-finished` 却一个字节都不给。网关把这种情况变成 502 并点名去查音色状态，
否则客户端拿到的是一个 200 的空音频，什么也听不出来。

### 自定义音色：两套 API 共用一个端点

`POST /api/v1/services/audio/tts/customization`，靠 `model` 字段区分。
**没有一个字段名相同**，传错的表现是 `Model not exist.` 或空的 400。

| | `voice-enrollment` | `qwen-voice-enrollment` |
|---|---|---|
| 目标模型 | `cosyvoice-v3.x`、`qwen-audio-3.x-tts` | `qwen3-tts-vc/vd-*` |
| 创建 | `create_voice` + `prefix` + `url` | `create` + `preferred_name` + `audio.data` |
| 列举 | `list_voice`（分页） | `list`（分页） |
| 查询 | `query_voice` → `status` | 无，从列举里挑 |
| 删除 | `delete_voice` + `voice_id` | `delete` + `voice` |
| 返回 ID | `output.voice_id` | `output.voice` |

音频地址：`voice-enrollment` 只收公网 URL 或 `oss://`（后者必须加
`X-DashScope-OssResourceResolve: enable`，不加上游不会去解析）；
`qwen-voice-enrollment` 的 `audio.data` 公网 URL 与 base64 data URI 都收。

样本上传（给只收地址的那一套用）：
`GET /api/v1/uploads?action=getPolicy&model={model}` → OSS 表单直传策略 →
表单 POST → `oss://{key}`（48 小时有效）。

**声音设计**走同一个 `create_voice`，把 `url` 换成 `voice_prompt` + `preview_text`，
另带 `parameters: { sample_rate, response_format }`，返回里有 base64 试听音频。
`preview_text` **至少 15 字**，短了回
`preview_text should not be shorter than 15 characters`。
`qwen3-tts-vd-*` 作为 target_model 在本账号上是
`preprocess service not found`（**未核实**是区域限制还是要单独开通）。

配额：每个账号每个模型族最多 1000 个音色；一年不用会被自动删除。

### 流式的实际收益（网关实测）

同一段 32 字文本、同一个 `cosyvoice-v3-flash`：

| | 首包 | 全程 | 音频字节 |
|---|---|---|---|
| 缓冲整包 | 2411ms | 2411ms | 107506 |
| `stream_format: audio` | **565ms** | 1994ms | 107506 |
| `stream_format: sse` | **566ms** | 2062ms | 107506 |

字节数三者完全一致，SSE 的 base64 往返无损。
`qwen-audio-3.0-tts-flash` 首包 436ms，`qwen3-tts-flash-realtime` 首包 697ms。
`format` 选 mp3 / pcm / wav 对首包时间没有明显影响（380 / 385 / 484ms）。

### 全目录实测结果（74 个语音模型）

**73 个可用**，只剩 1 个实时 ASR 本地拒绝（那套协议要求客户端边推音频边收文字，
一问一答的 HTTP 面承载不了）。

此前上游拒绝的 10 个现在全部有路可走：`cosyvoice-v3.5-*` 与
`qwen-audio-3.1-tts-flash` 先复刻音色再合成（已验证）；`qwen3-tts-vc/vd-*`
同理走 `qwen-voice-enrollment`。仍然不可用的只有 `sambert-clara-v1`、
`sambert-hanna-v1`、`sambert-zhishuo-v1` —— `Model not exist.`，
官方目录列了但服务上没有；其余 41 个 sambert 全部可用。

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
