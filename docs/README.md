# 文档索引与规范

这个目录同时装着四种不同寿命的东西。混在一起最大的代价不是乱，是**读的人无法判断一份文档还算不算数**——
本仓库已经出过实例：`development-doc.md` 的「目录结构」一节描述的还是从未落地的 `prisma/` 和单文件 `lib/presets.ts`，
却和仍然准确的章节并排放着，看起来一样权威。

所以规范只有一条核心要求：**每份文档顶部必须写清体裁、状态和最后核对日期。**

```
> 体裁：契约 · 状态：在用 · 最后核对：2026-09-20
```

## 四种体裁

| 体裁 | 含义 | 位置 | 过期时会怎样 |
|---|---|---|---|
| **契约** | 改代码必须同步改它；约束由 `AGENTS.md` 强制 | 本目录根 | 代码和约束脱节，改动绕过检查 |
| **参考** | 外部事实（厂商接口、计费、契约），我们只是记录 | `vendor-apis/` | 按过期的接口写实现 |
| **计划 / 设计** | 一次性产物，交付后只作决策记录 | `superpowers/{plans,specs}/` | 被误读成待办 |
| **非工程** | 口播稿、演示稿等 | 本目录根 | 无影响 |

状态取值：`在用` / `已交付` / `已废弃`。计划类交付后改成 `已交付` 并注明提交号，不要删——
它记录的是当初为什么这么选，代码里看不出来。

## 三条内容规则

这三条原本写在 `vendor-apis/README.md`，适用范围扩到整个 `docs/`：

1. **标注证据等级。** 实地打过接口写「已核对」，只读过文档写「文档」，查过但官方没有写「未公布」。
   不要用同类产品去推测填数——**错的数字比没有数字更糟**，这条在代码里也是一样的原则
   （见 `lib/services/model-capabilities.ts` 的三态能力位、`lib/services/pricing.ts` 的非美元返回 null）。
2. **参考资料不是代码契约。** 两边不一致时以真实响应为准，然后回来更新这里并刷新核对日期。
3. **不要写必然过期的内容。** 目录树、文件清单、行数统计这类东西，代码本身就是真相。
   删掉比修好——一份手写的目录树只会提供一个权威感十足的错误答案。

## 当前文档

### 契约

| 文件 | 内容 |
|---|---|
| [cc-switch-sync.md](cc-switch-sync.md) | 服务商预设、模型目录、定价、图标、余额、Coding Plan 的唯一维护入口 |
| [subscription-accounts.md](subscription-accounts.md) | 订阅账号的 OAuth 登录、额度查询与网关接入 |
| [development-doc.md](development-doc.md) | 需求、范围、架构与数据模型的主文档 |

### 参考

[vendor-apis/](vendor-apis/) —— 厂商官方接口资料库，一家一个文件，含已确认「没有」的否定结论
（[others.md](vendor-apis/others.md)，用来防止重复调研）。

### 计划 / 设计

[superpowers/plans/](superpowers/plans/) 与 [superpowers/specs/](superpowers/specs/)，文件名带日期。
当前 4 个计划 / 3 份设计，全部已交付。

### 非工程

[security-risk-deck-narration.md](security-risk-deck-narration.md) —— 对应 `/security-risk-deck.html` 的口播稿。
配套图片素材在 `security-risk-deck-assets/` 与 `security-risk-video-covers/`，两者都在 `.gitignore` 里，不入库。
