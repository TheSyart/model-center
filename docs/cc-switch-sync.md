# CC Switch 数据同步维护指南

本文档是服务商预设、模型目录、模型定价、图标、余额查询和 Coding Plan 元数据的唯一维护入口。修改这些生成数据前，先读本文及根目录 `AGENTS.md`。

## 当前固定来源

- 上游仓库：`https://github.com/farion1231/cc-switch.git`
- 本次提交：`9a596158ca926e74b56243c08af67d9dd13fc27c`
- 提交时间：`2026-08-24T16:49:56+08:00`
- 清单：`lib/presets/cc-switch-manifest.json`
- 完整规范化目录及排除账本：`lib/presets/cc-switch-catalog.json`

当前提交有 539 条数组预设，另有 `grokBuildOfficialPreset` 这一条独立导出，因此完整原始记录数是 **540**，不是 539。规范化结果为 255 个协议/Base URL 变体、4 个明确排除项、192 条最终模型定价和 99 个图标。基于这 255 个变体，当前运行时目录再生成 **82** 个逻辑服务商（218 个协议端点，9 次显式语义合并）。

## 源码位置与映射

| 数据 | CC Switch 源码 | 本项目输出 |
|---|---|---|
| Claude | `src/config/claudeProviderPresets.ts` | 预设、模型、env、端点、鉴权、能力元数据 |
| Claude Desktop | `src/config/claudeDesktopProviderPresets.ts` | 同上，按规范化身份合并重复项 |
| Codex | `src/config/codexProviderPresets.ts` | Responses/OpenAI 端点、TOML、模型和推理等级 |
| Gemini | `src/config/geminiProviderPresets.ts` | Gemini 端点、模型与能力 |
| Grok Build | `src/config/grokBuildProviderPresets.ts` | 数组预设加独立的 Grok Official |
| OpenCode | `src/config/opencodeProviderPresets.ts` | 预设、模型、兼容配置 |
| OpenClaw | `src/config/openclawProviderPresets.ts` | 预设、模型、兼容配置 |
| Hermes | `src/config/hermesProviderPresets.ts` | 预设、模型、兼容配置 |
| Pi | `src/config/piProviderPresets.ts` | 预设、模型、兼容配置 |
| Universal | `src/config/universalProviderPresets.ts` | 通用模板；无可执行 Base URL 的模板进入排除账本 |
| 模型定价 | `src-tauri/src/database/schema.rs` | `lib/pricing/cc-switch.ts`，四档美元/百万 Token 单价 |
| 图标 | `src/icons/extracted/`、`src/icons/extracted/index.ts` | `public/logos/`，保留真实扩展名 |
| 余额 | `src-tauri/src/services/balance.rs` | manifest 能力清单及 `lib/services/balance-provider.ts`/`balance.ts` |
| Coding Plan | `src/config/codingPlanProviders.ts`、后端 `coding_plan.rs` | manifest 能力清单及本项目套餐适配器 |

生成目录有两层，二者都必须保留：

- `cc-switch-catalog.json.providers` 是完整的 255 条低层协议/Base URL 变体，供审计、模型信息和来源追溯使用，禁止删除或以逻辑组替换。
- `cc-switch-catalog.json.logicalProviders` 与 `cc-switch.ts` 是运行时的 82 个逻辑服务商。每项包含稳定的 `presetKey`/`slug`、默认端点兼容字段 `protocol`/`baseUrl`、`defaultProtocol`、每协议一个 `endpoints` 条目及所有 `legacySlugs`。端点的 `alternateCandidates` 必须逐一列出其低层变体；`knownModels` 是预设知识，`modelCatalogComplete` 固定为 `false`，不可宣称完整模型目录。

生成的 `lib/presets/cc-switch.ts` 只保留选择器需要的逻辑组和端点字段；模型上下文窗口、最大输出、模态、推理等级、能力/兼容配置、端点候选和原始来源等完整信息仍在 catalog 的低层 `providers` 中。图标逻辑键先按 `iconUrls` 映射到真实 PNG/JPG/WebP/SVG 文件，再匹配同名 SVG；找不到物理资源时使用前端文字占位，禁止生成不存在的路径。所有源文件的 Git blob SHA 都写入 manifest，方便确认上游是否只改了无关文件。

## 获取不可变源码

先解析 `main`，再固定到 SHA，禁止在一次生成过程中直接读取可变的 `main`：

```bash
gh api repos/farion1231/cc-switch/commits/main --jq .sha
git clone --filter=blob:none --no-checkout https://github.com/farion1231/cc-switch.git /tmp/cc-switch-sync
git -C /tmp/cc-switch-sync sparse-checkout set src/config src/types src/utils src/icons/extracted src-tauri/src/database/schema.rs src-tauri/src/services/balance.rs
git -C /tmp/cc-switch-sync checkout --detach <SHA>
npm run sync:cc-switch -- --source /tmp/cc-switch-sync --ref <SHA>
```

不传 `--source` 时，脚本会自己创建临时稀疏克隆：

```bash
npm run sync:cc-switch -- --ref <SHA>
```

当前默认 SHA 写在 `scripts/sync-cc-switch.ts` 的 `PINNED_SHA`。完成新版本审查后更新它，保证普通同步命令可复现已批准版本。

## 归一化、去重与稳定 slug

1. 每条源记录先映射为统一结构，再按“厂商身份 + 原生协议 + 规范化 Base URL”合并。
2. 同厂商但协议不同，或协议相同但端点不同，保留为独立变体。不要仅按显示名称去重。
3. slug 来自稳定的厂商名、协议和必要的端点消歧；同步时必须检查 slug 唯一。已有本地 provider 行不会被生成数据覆盖，API Key、Base URL、启用状态、备注和优先级保持不变。
4. 推荐标记、历史 slug 兼容、余额与 Coding Plan 本地行为通过 `lib/presets/index.ts` 的稳定匹配覆盖，禁止重新拼接 `legacy + generated` 造成重复选择项。
5. OAuth-only、Bedrock 或其他当前网关无法鉴权的预设保留在 catalog，选择器中禁用并给出 `disabledReason`。
6. 无 Base URL 的自定义模板进入 `exclusions`。每条原始记录必须记为 included、merged 或 excluded，三类数量之和必须等于 rawProviderCount，禁止静默丢弃。

## 逻辑服务商分组与别名审查

低层变体先按原有“身份 + 协议 + Base URL”规则规范化，再按显示名称形成逻辑服务商；跨名称合并只能使用 `scripts/cc-switch-sync-lib.ts` 中的显式语义别名表。当前批准的别名是：Claude Official/Claude Desktop Official、Gemini Native/Google Official、xAI (Grok)/xAI (Grok) OAuth/Grok Official、Codex/OpenAI Official、火山 Coding Plan/火山Agentplan、StepFun/StepFun Step Plan、Bailian/Qwen Coder，以及 AWS Bedrock/AWS Bedrock (AKSK)。AWS Bedrock (API Key) 必须保持独立。

新增或变更别名时，先人工确认认证方式、地区、套餐与产品身份一致，再添加纯函数测试和固定快照断言；不得凭相似 URL、图标、模型名或厂商名自动合并。Kimi 与 Kimi For Coding、任何 `en` 区域变体、其他 Coding Plan 产品及不同认证模式均默认禁止合并，除非另有明确审查结论。每次同步必须检查 `logicalProviderCount`、`logicalEndpointCount`、`semanticMergeCount`，并确认候选 `variantSlug` 与 `legacySlugs` 各自都对 255 个低层变体形成一次且仅一次的完整覆盖。

生成的 canonical `presetKey` 也必须与本地 legacy slug 比较。仅当同名 legacy 的协议和 Base URL 与该逻辑组任一端点相同时，生成组才能保留该 slug；否则生成 key 必须以稳定的 `-cc-switch` 后缀消歧，本地 slug 继续解析到原本的 legacy 端点。此显式消歧之后，任何与其他生成逻辑组的 canonical key 冲突（包括 `-cc-switch` key）都必须终止同步并报错，禁止用顺序相关的数字后缀继续生成。同步测试必须遍历所有 legacy slug，不能只检查已知碰撞。

端点候选选择规则固定为：同协议内先选择受支持变体，再按协议来源优先级（OpenAI：opencode、openclaw、pi、hermes、codex；Responses：codex、grok-build；Anthropic：claude、claude-desktop；Gemini：gemini），之后按源序号和 variant slug 稳定回退。默认端点在受支持端点中按 openai、openai-responses、anthropic、gemini 的协议优先级选择。未选中的同协议 URL 仍必须留在 `alternateCandidates`。

## 四档定价规则

CC Switch 在 SQLite 初始化时先执行 `pricing_data` seed，再按源码顺序执行 `pricing_fixes`。repair 只有在当前四档价格同时匹配它携带的旧值守卫时才生效。本项目的解析器严格复现这个顺序：

1. seed 中重复模型遵循 SQLite `INSERT OR IGNORE`，保留第一条。
2. repair 按源文件顺序处理，守卫不匹配就跳过。
3. 得到最终 192 条全局价格后，覆盖预设模型目录中同模型的陈旧应用级价格。

运行时优先级是：用户手动价格 > CC Switch 服务商专属价格 > CC Switch 全局价格 > 无价格。四档字段分别为输入、输出、缓存读取、缓存写入。明确的零是有效免费价格；非零 Token 对应价格缺失时成本为 `null`，界面显示“—”。已有非空价格在迁移时标记为 `manual`，同步不得覆盖；“恢复 CC Switch 定价”才会清除手动优先级。

## 余额与 Coding Plan

固定提交内置 6 类余额查询：DeepSeek、StepFun、SiliconFlow 中国站、SiliconFlow 国际站、OpenRouter、Novita AI。识别必须基于 Base URL，不可依赖本项目 slug，因为一个厂商可能有 Claude、Codex 和 Gemini 多个变体。

Coding Plan 清单为 Kimi、智谱个人版、智谱团队版、MiniMax、ZenMux、火山方舟。智谱团队版与个人版 Base URL 相同，不能自动区分；火山方舟需要控制面 AK/SK，当前网关仍明确标记不支持。上游新增类型时，必须同时更新 manifest 解析校验和本地适配器，不能只增加选择器文字。

## 检查、测试与差异审查

生成后依次执行：

```bash
npm run sync:cc-switch -- --source /tmp/cc-switch-sync --ref <SHA> --check
npm test
npx tsc --noEmit --incremental false
npm run build
git diff -- lib/presets/cc-switch.ts lib/presets/cc-switch-catalog.json lib/presets/cc-switch-manifest.json lib/pricing/cc-switch.ts public/logos
```

审查至少确认：SHA 和 blob SHA 正确；10 类来源都存在；255 个低层变体、82 个逻辑服务商、9 次语义合并和逻辑候选/旧 slug 覆盖均符合基线；数量变化有上游证据；覆盖账本闭合；canonical slug 无重复；OAuth/不支持项仍被禁用；定价 repair 后数量和关键价格正确；图标数量及 checksum 正确；重复运行 `--check` 无差异。

当前基线数量：Claude 77、Claude Desktop 74、Codex 72、Gemini 23、Grok Build 38（含独立 Official）、OpenCode 65、OpenClaw 65、Hermes 66、Pi 58、Universal 2。上游数量变化不是自动错误，但必须先审查结构与语义，再更新脚本断言和本文基线。

## 回滚与故障排查

- 生成失败或结果可疑时，不要手改生成文件；保留错误输出，固定回上一个 manifest SHA 重新生成。
- TypeScript 预设结构变化：先检查新增 import、导出名、`apiFormat`、Base URL 和模型字段，再更新沙箱模块加载器及规范化测试。
- 数量不符：比较各源文件导出，尤其检查是否新增了像 Grok Official 一样的独立导出。
- 定价数量或价格不符：检查 Rust 数组名、tuple 长度、seed 重复语义和 repair 守卫字段顺序。
- 图标不符：检查 `src/icons/extracted/index.ts` 的 `iconUrls`、逻辑键别名及资源扩展名；不要把 `index.ts`、`metadata.ts` 当图标，也不要默认拼接 `.svg`。
- 新增鉴权类型：先判断网关能否只用 API Key 实现；不能实现时保留元数据并禁用，而不是删除。
- 新增余额/Coding Plan 类型：先更新纯识别函数和单元测试，再接网络解析；网络失败不得影响模型请求。
- 回滚生成结果时只恢复上述生成文件和图标，不要重置数据库、服务商配置或用户未提交修改。
