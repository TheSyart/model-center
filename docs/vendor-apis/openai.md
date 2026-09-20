# OpenAI

价格页：https://developers.openai.com/api/docs/pricing
（旧地址 `platform.openai.com/docs/pricing` 会 301 到这里）
核对日期：2026-09-18（文档核对）
**币种：美元**

## 内置工具计费

随 Responses 请求下发。

| 工具 | 计费 |
|---|---|
| **Web Search**（全模型标准档） | **$10 / 千次**，搜索内容另按模型 token 计价 |
| Web Search（图片搜索） | $10 / 千次 + 内容 token |
| Web Search Preview（推理模型） | $10 / 千次 + 内容 token |
| Web Search Preview（非推理模型） | **$25 / 千次**，**搜索内容免费** |
| **File Search** 调用 | **$2.50 / 千次** |
| **File Search** 存储 | **$0.10 / GB·天**，首 1 GB 免费 |
| **Code Interpreter / Hosted Shell** | 按 20 分钟会话计，随内存规格递增：1 GB **$0.03**、4 GB **$0.12**、16 GB **$0.48**、64 GB **$1.92**。按分钟计费，最短 5 分钟 |

原文表格：

> Tool | Details | Pricing — Web search | Web search (all models) | $10.00 / 1k calls + Search content tokens billed at model rates. — File search | Storage | $0.10 / GB per day (1 GB free) — Containers | Hosted Shell and Code Interpreter | 1 GB $0.03, 4 GB $0.12, 16 GB $0.48, 64 GB $1.92 per 20-minute session

图像生成与 computer use 的价格未在该工具表中单列。

## Codex OAuth 订阅（已实现）

见 `docs/subscription-accounts.md`。
- 授权 `https://auth.openai.com/oauth/authorize`，client `app_EMoamEEZ73f0CkXaXp7hrann`
- 推理 `POST https://chatgpt.com/backend-api/codex/responses`
- 额度 `GET https://chatgpt.com/backend-api/wham/usage`，头 `ChatGPT-Account-Id`
- 模型目录 `GET https://chatgpt.com/backend-api/codex/models`（**未接入**，可作为订阅账号的模型发现来源）
