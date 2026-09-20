# MiniMax

文档站：https://platform.minimax.cn/docs
核对日期：2026-09-19（文档核对）

## 服务端工具

文档：https://platform.minimax.cn/docs/guides/server-tools

目前只有一个，**随推理请求下发**，服务端自动执行，无需手工回传工具结果：

| 工具 | 协议面 | 声明方式 |
|---|---|---|
| `web_search` | Anthropic Messages | `{"type": "web_search_20250305", "name": "web_search"}` |
| `web_search` | OpenAI Responses | `{"type": "web_search"}` |

**计费：¥0.03 / 次**（来源：https://platform.minimax.cn/docs/guides/pricing-paygo ——「联网搜索，模型在服务端自动执行搜索并基于结果作答」）

MCP 指南：https://platform.minimax.cn/docs/guides/mcp-guide

## 按量计费

文档：https://platform.minimax.cn/docs/guides/pricing-paygo
**币种：人民币**，文本按每百万 token 计。

摘录（核对于 2026-09-19，会变，用前请重新核对）：

| 项目 | 价格 |
|---|---|
| MiniMax-M3 标准档 | ¥2.10–4.20 / 百万输入 token（含永久 5 折） |
| MiniMax-M3 优先档 | ¥3.15–6.30 / 百万输入 token（标准价 1.5 倍） |
| ASR | ¥2.50 / 小时 |
| TTS（speech-2.8-hd） | ¥3.50 / 万字符 |
| 音色设计 / 复刻 | ¥9.90 / 个 |
| MiniMax-H3 视频 768P | ¥0.50 / 秒 |
| image-01 | ¥0.025 / 张 |
| MCP（API-vlm） | ¥0.025 / 次 |

「优先服务」档按标准价 1.5 倍收费，换更快响应与更低失败率。

定价总览：https://platform.minimax.cn/docs/pricing/overview
（该页是索引，实际价格在 `guides/pricing-paygo` 与 `guides/pricing-token-plan`）

## 余额

**无公开接口。** 官方 API 概览只覆盖语言/视频/语音/图像/音乐/文件，没有账户余额、配额、用量或账单查询接口。已交叉核对 `one-api`、`new-api`、`cc-switch` 三套实现，均无 MiniMax 余额解析器。

## 套餐额度

**有**，已实现于 `lib/services/coding-plan.ts` 的 `queryMinimax`：
`GET {origin}/v1/api/openplatform/coding_plan/remains`，`Authorization: Bearer`。
注意响应里给的是**剩余量**，本项目转成已用百分比（`100 - remain`）；周额度仅在 `current_weekly_status === 1` 时有效。

国内站 `api.minimaxi.com`、国际站 `api.minimax.io`，两者在 `detectCodingPlan` 里分别识别为 `minimax-cn` / `minimax-en`。
