# Anthropic

价格页：https://platform.claude.com/docs/en/about-claude/pricing
核对日期：2026-09-18（文档核对）
**币种：美元**

## Server tool 计费

随 Messages 请求以 server tool 形式下发，在 token 费用之外单独计价。

| 工具 | 计费 | 说明 |
|---|---|---|
| **Web Search** | **$10 / 千次搜索** | 每次搜索算一次，不论返回多少结果；搜索出错不计费。搜索内容本身按输入 token 另计 |
| **Web Fetch** | **不额外收费** | 只付抓回内容的 token。可用 `max_content_tokens` 限制体积 |
| **Code Execution** | **$0.05 / 容器·小时**，每组织每月 **1,550 小时免费** | 最短计 5 分钟。**与 `web_search_20260209+` 或 `web_fetch_20260209+` 同时使用时完全免费**。请求里带文件时即使没调用工具也会计时（文件要预载进容器） |
| **Bash** | 不额外收费 | 工具定义占 325 tokens（Opus 5 / 4.8 / 4.7）或 244 tokens（4.6 及更早） |
| **Text Editor** | 不额外收费 | `text_editor_20250429` 占约 700 tokens |
| **Computer Use** | 不额外收费 | `computer_toolset_20260801` 约 4,500 输入 tokens；截图按图片输入计价 |
| **Browser Use** | 不额外收费 | `browser_toolset_20260801` 约 6,600 输入 tokens |
| Managed Agents 会话 | **$0.08 / 会话·小时** | 只在 `running` 状态计时；替代 code execution 的容器计时 |

用量在响应的 `usage.server_tool_use` 里回报（`web_search_requests`、`web_fetch_requests`、`code_execution_requests`）。

## 其它与本项目相关的计费口径

- 缓存：5 分钟写入 1.25×、1 小时写入 2×、命中 0.1×（Fable 5.1 / Mythos 5.1 是 0.025×）
- Batch API：输入输出各 5 折
- `inference_geo: "us"` 数据驻留：全部 token 价格 1.1×
- Fast mode（Opus 5 / 4.8）：$10 / $50 每百万 token

## OAuth 订阅（已实现）

见 `docs/subscription-accounts.md`。额度接口 `GET https://api.anthropic.com/api/oauth/usage`，头 `anthropic-beta: oauth-2025-04-20`。
