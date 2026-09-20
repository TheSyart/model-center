# 服务商官方接口资料库

用户提供与实地核对过的厂商官方资料，集中保管在这里，避免下次再从零调研。

## 这个目录是什么

- **每条接口都标注核对日期与来源链接。** 时间久了官方会改，看到日期就知道该不该重新核对。
- **实地核对过的写「已核对」，只读过文档的写「文档」，没查到的写「未公布」。** 不用同类产品的价格去推测填数——错的价格比没有价格更糟。
- 这里是**参考资料**，不是代码契约。代码里的实现以 `lib/` 下对应模块为准，两边不一致时以真实响应为准并回来更新这里。

## 文件

| 文件 | 内容 |
|---|---|
| [`kimi.md`](kimi.md) | Kimi / 月之暗面：工具接口、余额、模型列表 |
| [`zhipu.md`](zhipu.md) | 智谱 GLM：7 个工具接口、Coding Plan 额度 |
| [`bailian.md`](bailian.md) | 阿里云百炼：模型目录与价格、能力枚举、鉴权分层、工具 |
| [`minimax.md`](minimax.md) | MiniMax：服务端工具、按量计费 |
| [`anthropic.md`](anthropic.md) | Anthropic：server tool 计费 |
| [`openai.md`](openai.md) | OpenAI：内置工具计费 |
| [`others.md`](others.md) | 已确认**没有**公开接口的厂商，附排查过程 |
| [`_sources/bailian-cli/`](_sources/bailian-cli/) | 用户提供的百炼官方 CLI 技能包原件（25 个文件） |

## 代码里的对应位置

| 资料 | 落地在 |
|---|---|
| 工具目录与计费 | `lib/vendors/tools.ts` → `/tools` 页面 |
| 百炼模型目录与官方价格 | `lib/vendors/bailian/catalog.ts`、`lib/services/model-sync.ts` |
| 余额查询 | `lib/vendors/balance.ts`、`lib/presets/balance-provider.ts` |
| 套餐额度 | `lib/vendors/coding-plan.ts` |
| 模型能力 | `lib/services/model-capabilities.ts` |

## 维护约定

1. 新增或改动任何一条，**同时更新核对日期**。
2. 价格一律记录**原始币种与单位**，不做折算。百炼、Kimi、智谱、MiniMax 都是人民币，Anthropic、OpenAI 是美元。
3. 官方没写的就写「未公布」，并说明查过哪里。
4. `_sources/` 下是原件，**不要编辑**；要修正就在对应的 `.md` 里写明差异。
