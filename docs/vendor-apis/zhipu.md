# 智谱 GLM

文档站：https://docs.bigmodel.cn
核对日期：2026-09-19（文档核对）
主机：`https://open.bigmodel.cn/api/paas/v4`，全部 `Authorization: Bearer {API_KEY}`

## 工具接口

### 网络搜索 `POST /web_search`
文档：https://docs.bigmodel.cn/api-reference/工具-api/网络搜索

面向大模型优化的搜索，带意图识别与结构化输出。

入参：`search_query`（必填，≤70 字符）、`search_engine`（必填）、`search_intent`、`count`（1–50，默认 10）、`search_domain_filter`、`search_recency_filter`、`content_size`
出参：标题、URL、摘要、站点名、图标

**四个引擎按档计价：**

| `search_engine` | 说明 | 价格 |
|---|---|---|
| `search_std` | 基础版（智谱自研） | **¥0.01 / 次** |
| `search_pro` | 高级版（智谱自研），多引擎协同，显著降低空结果 | **¥0.03 / 次** |
| `search_pro_sogou` | 搜狗，覆盖腾讯生态与知乎 | **¥0.05 / 次** |
| `search_pro_quark` | 夸克，垂直内容 | **¥0.05 / 次** |

价格来源：https://docs.bigmodel.cn/cn/guide/tools/web-search

### 网页阅读 `POST /reader`
文档：https://docs.bigmodel.cn/api-reference/工具-api/网页阅读

入参：`url`（必填）、`timeout`（默认 20s）、`no_cache`、`return_format`（markdown/text，默认 markdown）、`retain_images`（默认 true）、`no_gfm`、`keep_img_data_url`、`with_images_summary`、`with_links_summary`
出参：`{ id, created, request_id, model, reader_result: { content, title, description, url, external, metadata } }`
**价格：未公布**（API 文档页未给出）

### 内容安全 `POST /moderations`
文档：https://docs.bigmodel.cn/api-reference/工具-api/内容安全

入参：`model`（枚举 `moderation`）、`input`（文本 ≤2000 字符，或多模态对象，或混合数组）
支持类型：`text` / `image_url`（≤10MB，20×20–6000×6000）/ `video_url`（建议 30 秒）/ `audio_url`（建议 60 秒）
出参：`result_list[].{ content_type, risk_level, risk_type[] }`，`usage.moderation_text.call_count`

风险等级：`PASS`（通过）、`REVIEW`（转人工）、`BLOCK`（拦截）、`REJECT`（终止会话）、`HIGH`（拦截并回滚输入）
**价格：未公布**

### 文件解析（同步）`POST /files/parser/sync`
文档：https://docs.bigmodel.cn/api-reference/工具-api/文件解析同步

`multipart/form-data`：`file`（必填）、`tool_type=prime-sync`（必填）、`file_type`（可选，28 种格式：PDF/DOCX/XLSX/PNG/JPG/CSV/TXT/MD/HTML/HEIC/WEBP/TIFF/JP2 等）
出参：`{ status: succeeded|processing|failed, message, task_id, content?, parsing_result_url? }`
**价格：未公布**

### 文件解析（异步）`POST /files/parser/create`
文档：https://docs.bigmodel.cn/api-reference/工具-api/文件解析

`multipart/form-data`：`file`（必填）、`tool_type`（必填，`lite` / `expert` / `prime`）、`file_type`（可选）

支持格式随档位不同：
- `lite`：PDF, DOCX, DOC, XLS, XLSX, PPT, PPTX, PNG, JPG, JPEG, CSV, TXT, MD
- `expert`：**仅 PDF**
- `prime`：全部，含 HTML/BMP/GIF/WEBP/HEIC/EPS/ICNS/IM/PCX/PPM/TIFF/XBM/HEIF/JP2

出参：`{ success, message, task_id }`，需配合下面的结果接口轮询
**价格：未公布**

### 解析结果 `GET /files/parser/result/{taskId}/{format_type}`
文档：https://docs.bigmodel.cn/api-reference/工具-api/解析结果

路径参数：`taskId`、`format_type`（`text` 或 `download_link`）
出参：`{ status, message, task_id, content?, parsing_result_url? }`
结果查询本身不单独计费，费用计在解析任务上。

### OCR 服务 `POST /files/ocr`
文档：https://docs.bigmodel.cn/api-reference/工具-api/ocr-服务

`multipart/form-data`：`file`（必填，JPG/PNG）、`tool_type=hand_write`（必填，手写体识别）、`language_type`（可选，25 种：CHN_ENG / AUTO / ENG / JAP / KOR / FRE / SPA / POR / GER / ITA / RUS / DAN / DUT / MAL / SWE / IND / POL / ROM / TUR / GRE / HUN / THA / VIE / ARA / HIN）、`probability`（默认 false）
出参：`{ task_id, status, message, words_result_num, words_result[] }`
**价格：未公布**

## 余额与套餐

- **余额：无公开接口。** 已查过智谱官方文档、`one-api`、`new-api`、`cc-switch` 四处实现，均无智谱余额解析器。
- **Coding Plan 额度：有**，`GET {origin}/api/monitor/usage/quota/limit`。
  注意鉴权头是 `Authorization: {apiKey}`，**不带 `Bearer` 前缀**，另需 `Accept-Language: en-US,en`。
  已实现于 `lib/vendors/coding-plan.ts` 的 `queryZhipu`。

## 模型列表

`GET /models` 只返回 OpenAI 裸结构 `{id, object, created, owned_by}`，**没有能力或价格字段**。
