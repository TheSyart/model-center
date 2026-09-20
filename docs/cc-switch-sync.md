# CC Switch 数据同步维护指南

> 体裁：契约 · 状态：在用 · 最后核对：2026-09-19
> 这是服务商预设、模型目录、定价、图标、余额与 Coding Plan 的唯一维护入口，
> 约束由根目录 `AGENTS.md` 强制。厂商官方接口的调研结论在 `vendor-apis/`。

本文档是服务商预设、模型目录、模型定价、图标、余额查询和 Coding Plan 元数据的唯一维护入口。修改这些生成数据前，先读本文及根目录 `AGENTS.md`。CC Switch 是默认上游，不是所有厂商的唯一上游；厂商专属规则优先于后文的通用规则。

## 数据源策略：百炼使用官方来源（2026-09-03）

按用户决定，**阿里云百炼 / Alibaba Cloud Model Studio 改为官方直连数据源，不再通过 CC Switch 更新该厂商的预设、模型资料和定价**。其他厂商继续使用 CC Switch 固定快照。

- 身份范围：当前逻辑供应商 `bailian`（Bailian，包含历史 Qwen Coder 别名）及 `bailian-for-coding`（Bailian For Coding）。两者分别维护，不合并普通按量服务与 Coding Plan，不跨地域或凭据共享配置。未来新增百炼身份必须显式加入映射。
- `GET /api/v1/models` 用于常规模型目录、能力、上下文与价格元数据；`GET /modelstudio/billing/overview` 用于月度官方账单概览。模型名称含 `qwen` 不代表供应商是百炼；第三方平台销售 Qwen 模型的配置与定价不在此例外内。
- 模型调用 Base URL、Logo、鉴权提示、Coding Plan 等这两个接口未提供的信息，改从对应百炼官方文档或官方资源维护，不能声称已由这两个接口覆盖。普通模型目录不能代替 Coding Plan 专属目录或套餐额度。
- **落地状态（2026-09-17）：普通 `bailian` 的模型同步已切换到北京地域官方 Workspace 模型目录。** 服务商需配置 `workspace_id`；运行时逐页读取 `output.total/page_no/page_size/models`，对官方 429 限流执行有限退避重试，所有页面校验成功后才事务入库，并保存新模型的官方名称和上下文长度。同步失败保留上次成功数据，不回退到 CC Switch 价格。`bailian-for-coding`、官方价格、账单概览和生成预设仍未切换，继续按本节边界单独实现。
- 保留当前 CC Switch 历史快照、用户手动配置和手动价格。后续实现来源切换时，不再用新的 CC Switch 百炼记录覆盖它们；不要为了这次文档更新手改生成文件、删除服务商或改动基线数量。

完整接口契约、价格边界与下一次接入步骤见下方“阿里云百炼官方接口维护契约”。

## CC Switch 固定快照（保留历史基线）

- 上游仓库：`https://github.com/farion1231/cc-switch.git`
- 本次提交：`9a596158ca926e74b56243c08af67d9dd13fc27c`
- 提交时间：`2026-08-24T16:49:56+08:00`
- 清单：`lib/presets/cc-switch-manifest.json`
- 完整规范化目录及排除账本：`lib/presets/cc-switch-catalog.json`

当前提交有 539 条数组预设，另有 `grokBuildOfficialPreset` 这一条独立导出，因此完整原始记录数是 **540**，不是 539。规范化结果为 255 个协议/Base URL 变体、4 个明确排除项、192 条最终模型定价和 99 个图标。基于这 255 个变体，当前运行时目录再生成 **82** 个逻辑服务商（218 个协议端点，9 次显式语义合并）。这些是包含百炼在内的现存历史快照数量，不代表未来官方来源切换后的生成基线。

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
| 余额 | `src-tauri/src/services/balance.rs` | manifest 能力清单及 `lib/presets/balance-provider.ts` / `lib/vendors/balance.ts` |
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

以下是 CC Switch 通用规则；百炼后续来源切换遵循本文开头的厂商例外和下文的覆盖账本要求。

1. 每条源记录先映射为统一结构，再按“厂商身份 + 原生协议 + 规范化 Base URL”合并。
2. 同厂商但协议不同，或协议相同但端点不同，保留为独立变体。不要仅按显示名称去重。
3. slug 来自稳定的厂商名、协议和必要的端点消歧；同步时必须检查 slug 唯一。已有本地 provider 行不会被生成数据覆盖，API Key、Base URL、启用状态、备注和优先级保持不变。
4. 推荐标记、历史 slug 兼容、余额与 Coding Plan 本地行为通过 `lib/presets/index.ts` 的稳定匹配覆盖，禁止重新拼接 `legacy + generated` 造成重复选择项。
5. OAuth-only 预设保留在 catalog，从 API Key 服务商选择器移到“订阅账号”；已实现的授权入口按订阅模块能力启用，未实现的厂商保留图标和禁用占位。Bedrock 或其他当前网关无法鉴权的非 OAuth 预设仍在 API Key 选择器中禁用并给出 `disabledReason`。
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

当前代码的运行时优先级是：用户手动价格 > CC Switch 服务商专属价格 > CC Switch 全局价格 > 无价格。百炼切换完成后必须改为：用户手动价格 > 相同服务范围下的百炼官方价格 > 无价格，不再回退 CC Switch 的服务商或全局价格。其他厂商的优先级不变。

四档字段分别为输入、输出、缓存读取、缓存写入。明确的零是有效免费价格；非零 Token 对应价格缺失时成本为 `null`，界面显示“—”。已有非空价格在迁移时标记为 `manual`，同步不得覆盖。当前“恢复 CC Switch 定价”操作在百炼接入时需调整为恢复该厂商的官方自动定价，不能清除手动价格后又套回 CC Switch。

## 余额与 Coding Plan

固定提交内置 6 类余额查询：DeepSeek、StepFun、SiliconFlow 中国站、SiliconFlow 国际站、OpenRouter、Novita AI。识别必须基于 Base URL，不可依赖本项目 slug，因为一个厂商可能有 Claude、Codex 和 Gemini 多个变体。

Coding Plan 清单为 Kimi、智谱个人版、智谱团队版、MiniMax、ZenMux、火山方舟。智谱团队版与个人版 Base URL 相同，不能自动区分；火山方舟需要控制面 AK/SK，当前网关仍明确标记不支持。上游新增类型时，必须同时更新 manifest 解析校验和本地适配器，不能只增加选择器文字。

## 阿里云百炼官方接口维护契约

### 资料来源与覆盖边界

记录日期：2026-09-03。用户提供了模型列表完整说明及账单概览参数和示例，本节将其整理为持久契约，不依赖临时附件路径。公开文档核对来源：

- [查询模型列表（中文）](https://help.aliyun.com/zh/model-studio/list-models)
- [GetBillingOverview（中文，API 版本路径 2026-02-10）](https://help.aliyun.com/zh/model-studio/api-modelstudio-2026-02-10-getbillingoverview)
- [GetBillingOverview（英文）](https://help.aliyun.com/en/model-studio/api-modelstudio-2026-02-10-getbillingoverview)

| 项目需要的信息 | 官方来源 | 能力边界 |
|---|---|---|
| 模型 ID、名称、作者、实际推理商、能力、上下文 | 模型列表接口 | 支持分页及筛选；目录可见不等于每个调用协议、套餐或账号都能调用 |
| 模型价格 | 模型列表中的 `prices` | 保留阶梯、计费项、单位；不能默认存在四档 Token 价格或默认美元 |
| 月度账单及按模型、API Key、业务空间等分组的费用 | 账单概览接口 | 一次只按一个维度分组，最多返回 Top 20，不是完整账单明细 |
| 本平台逐请求 Token、缓存用量、首字延迟及耗时 | 现有网关用量采集与日志 | 两个官方接口不能替代，不把月账单写入请求日志或 Token 日统计 |
| 账户可用余额、套餐剩余额度、5 小时/7 天用量 | 尚需其他官方接口或文档 | 月度费用不是余额，订阅费用也不是 Coding Plan 额度 |
| 调用端点、Logo、Coding Plan 专属配置 | 相应百炼官方文档/资源 | 本节两个接口不直接提供；缺失时标记待补充，不回到 CC Switch 猜测 |

### 模型列表：`GET /api/v1/models`

使用百炼 API Key，在请求头传 `Authorization: Bearer {API_KEY}`；开发期凭据可由 `DASHSCOPE_API_KEY` 环境变量提供。不要把 Model Center 网关令牌用于此上游接口，也不要把真实密钥写入文档、快照或日志。

模型目录服务地址与推理 Base URL 独立维护，**不得把下表地址直接当作 Chat/Responses/Messages 的 Base URL**，也不能简单在已有 `/compatible-mode/v1` 后追加 `/api/v1/models`。

| 地域 | 官方模型列表 URL |
|---|---|
| 北京 | `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/models` |
| 新加坡 | `https://dashscope-intl.aliyuncs.com/api/v1/models` |
| 中国香港 | `https://cn-hongkong.dashscope.aliyuncs.com/api/v1/models` |
| 东京 | `https://{WorkspaceId}.ap-northeast-1.maas.aliyuncs.com/api/v1/models` |
| 法兰克福 | `https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/api/v1/models` |
| 弗吉尼亚 | `https://{WorkspaceId}.us-east-1.maas.aliyuncs.com/api/v1/models` |

`{WorkspaceId}` 是阿里云业务空间 ID；需要空间子域的地域必须显式配置并校验，不能猜测默认值。凭据、地域、空间、服务站点和推理服务商必须对应同一服务范围。

所有参数通过 Query String 传递；数组使用重复参数键，例如 `capabilities=TG&capabilities=Reasoning`，不要自行改为逗号拼接或 JSON 数组。

| 参数 | 契约及同步用途 |
|---|---|
| `name` / `model` | 分别为名称模糊查询、模型 ID 精确查询；全量同步不使用此类缩小范围的过滤 |
| `language` | `zh-CN` 或 `en-US`；仅选择返回语言，不能据此推断币种 |
| `page_no` / `page_size` | 从第 1 页开始，默认每页 20；没有依据时不假定最大页大小 |
| `providers[]` | 模型作者；不能为“同步百炼”固定填 `qwen`，否则会漏掉百炼托管的其他作者模型 |
| `inference_providers[]` | 实际推理服务商；根据目标配置选择，不把返回的第三方渠道价格混入百炼直连价格 |
| `capabilities[]` / `features[]` | 模态类型与能力过滤；全量目录同步不要只取具备特定能力的子集 |
| `context_window` | 返回上下文长度严格小于该值的模型；全量同步时省略 |
| `service_site` | 部署模式；不传会返回所有模式，同一模型跨站点价格不能混用 |
| `supports[]` | 默认 `inference`；另支持 `deploy`，部署可用不等于网关推理可用 |
| `deployment_methods[]` | 文档给出 `ptu`（预置吞吐量） |
| `deployment_ptu_service_tiers[]` | PTU 类型筛选；使用时 `deployment_methods` 必须包含 `ptu` |

本次资料中的枚举如下。下次维护以官方实际契约为准，保留新增/未知值的原始信息，不静默丢弃：

- `providers`：`qwen`、`zhipu-ai`、`wan`、`qwen-domain-model`、`mini-max`、`moonshot-ai`、`deepseek`、`happyhorse`、`kling`、`pixverse`、`vidu`、`tripo`、`xiaomi`。
- `inference_providers`：`aliyun-bailian`、`alibaba-cloud-modelstudio`、`siliconflow`、`moonshot`、`mini-max`、`kling`、`vidu`、`pixverse`、`vanchin`、`xiaomi`、`zhipu-ai`、`tripo`。
- `capabilities`：`Reasoning`、`VU`、`IG`、`VG`、`ASR`、`TTS`、`ME`、`Realtime-Omni`、`Multimodal-Omni`、`Realtime-Text-to-Speech`、`TG`、`TR`、`Realtime-ASR`、`Realtime-Audio-Translate`、`3D-generation`、`Realtime-Chatting`。
- `features`：`model-experience`、`function-calling`、`structured-outputs`、`web-search`、`prefix-completion`、`cache`、`batch`、`fine-tuning`。
- `service_site`：`global`、`international`、`asia-pacific-china`、`cn-hongkong`、`european-union`、`united-states`、`japan`。

北京地域的单页请求示例（变量由运行环境提供；只是第一页，不代表已完成全量同步）：

```bash
curl --fail-with-body --get \
  "https://${BAILIAN_WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com/api/v1/models" \
  --header "Authorization: Bearer ${DASHSCOPE_API_KEY}" \
  --data-urlencode 'language=zh-CN' \
  --data-urlencode 'supports=inference' \
  --data-urlencode 'page_no=1' \
  --data-urlencode 'page_size=20'
```

响应和本地映射规则：

| 官方字段 | 本项目处理要求 |
|---|---|
| `success`、`code`、`message`、`request_id` | 同时校验 HTTP 状态和业务成功状态；保留请求 ID 供排错，不能因 HTTP 200 就视为成功 |
| `output.total/page_no/page_size/models` | 逐页抓取并校验总量、页码与结构；防重复页、意外空页及上限截断，全部成功后再事务写入 |
| `models[].model` | 真实调用 ID，对应 `models.model_id`；不要以显示名称或作者名替换 |
| `name/description/provider/inference_provider` | 保留显示资料；`provider` 是模型作者，`inference_provider` 是实际供给渠道，不能混为本地供应商身份 |
| `capabilities/features` | 保留原值及未知枚举；不自动开启当前网关尚未支持的图像、音频、视频或实时接口 |
| `inference_metadata.request_modality/response_modality` | 输入/输出模态，记录 `Text/Image/Audio/Video`；缺失和空列表不擅自等同于“只支持文本” |
| `model_info.*` | 保存 `context_window`、`max_input_tokens`、`max_output_tokens`、`max_reasoning_tokens`、`reasoning_max_input_tokens`、`reasoning_max_output_tokens`；保留 `null`，不改成 0 或武断断言无限制 |
| `published_time/equivalent_snapshot` | 保留可选的发布时间与快照关系；不擅自补时区、伪造发布时间或改写调用 ID |
| `prices[].range_name/prices[]` | 原样保留全部阶梯及计费项，按下一节规则转为可用定价 |

`lib/services/model-sync.ts` 已为普通 `bailian` 增加专属适配器，独立于推理 Base URL 组装 Workspace 模型目录地址，并按 `output.total` 完成分页。全量模型目录不等于协议级支持清单，因此同步结果不会把 OpenAI 兼容端点的 `provider_endpoints.model_catalog_complete` 标记为完整。

### 官方价格与四档价格的映射

百炼的自动定价必须按供应商、地域、服务站点、实际推理商和模型 ID 匹配；同名模型在不同渠道或区域的价格不能互相覆盖。目标优先级为：手动价格 > 已验证的百炼官方价格 > 未定价。

| 官方计费项 | 处理规则 |
|---|---|
| `type=input_token` | 核实币种、单位及适用阶梯后，映射输入价格 `input_price` |
| `type=output_token` | 同上，映射输出价格 `output_price` |
| 缓存读取/写入计费项 | 本次资料未给出确切 `type` 枚举；待官方响应或说明确认后映射 `cache_read_price/cache_write_price`，不能自行发明键名 |
| `type=image_number` 等非 Token 项 | 保留原价和单位，不能塞入输入/输出 Token 单价；当前成本计算不支持时明确标注 |

- `features` 中出现 `cache` 只说明能力，不代表缓存免费，也不提供缓存读取或写入价格。缺失价格保持 `null`；明确的 0 才是免费。
- `price` 是价格值，`price_unit` 是计费单位，`price_name` 是描述。每百万 Token、每千 Token、每张、每秒等不能混算。确认单位后才可做精确换算；金额/单价采用十进制精度处理。
- 本次模型接口说明没有明确的币种字段。**不能将示例 `2`、`8` 或其他数值直接当作美元，也不能根据中文/英文、地域或另一账单响应猜币种。** 接入时须补同一模型、区域、站点的官方定价证据。
- 当前项目四档价格以美元/百万 Token 为口径。若官方提供人民币或其他币种，应先支持并展示原生币种，或另行明确可追溯换汇规则；在此之前不能直接写入现有美元价格字段。
- `range_name=Default` 与上下文分段价格不同。存在 `32k<Input<=128k` 等阶梯时保留全部区间，不能取第一档、最低档或平均值冒充固定单价；现有计算器无法可靠匹配时，成本保持未知并说明原因。
- 官方来源标识建议为 `aliyun-modelstudio`（待实现，不是现有枚举已经支持）。沿用 `pricing_source/pricing_source_ref/pricing_synced_at` 的语义，并补充官方 URL、获取时间、地域/站点、内容校验值等追溯信息；HTTP 数据不能伪装成 CC Switch 的 Git SHA。
- 已存在的手动四档价格继续优先；更新官方自动价格不能覆盖手动项。缺价或同步失败不得自动改用 CC Switch 百炼价、全局 Qwen 价或其他作者模型的直销价。

### 账单概览：`GET /modelstudio/billing/overview`

该接口查询指定月份的费用，不是账户余额查询，也不提供单次模型调用的 Token 明细。

**鉴权与传输待核实：** 用户资料及此次核对的动作说明没有明确给出服务 Host、鉴权/签名方式及 `groupBy/filter` 的线上序列化形式。实现前必须从服务级官方文档或官方 SDK 确认。不能把模型目录 Host 或 `Authorization: Bearer DASHSCOPE_API_KEY` 直接套用到账单接口，也不能自行认定它需要 AccessKey 签名或控制台 Cookie。

| 参数 | 必填 | 契约 |
|---|---|---|
| `billMonth` | 是 | 非空 `YYYY-MM`，校验真实月份；不要硬编码文档示例月份 |
| `groupBy` | 是 | 对象数组，必须且只能包含一个维度；成员含 `code` |
| `filter.dimensions` | 否 | 对象数组，每项可含 `code`、字符串数组 `values`、`selectType` |
| `topNum` | 否 | 1–20，默认 20；这是分组数量，不是页码或分页大小 |
| `zeroFilter` | 否 | boolean，默认 true；显式 false 必须保留 |
| `regionId` | 否 | 地域 ID，例如 `cn-beijing`，由实际账单范围决定 |
| `locale` | 否 | `en-US` 或 `zh-CN`，默认 `en-US` |

`selectType` 存在资料差异：用户提供版本与本次英文官方页面写的是 `IN / NOT`，中文官方页面写的是 `INCLUDE / EXCLUDE`。**不得把任一组宣称为已经联调通过。** 下次接入先用官方 SDK/版本定义或实际只读查询确认，记录采用的值、版本与日期，并用成功/失败用例覆盖；不要静默替换用户提供的原始枚举。

`groupBy[].code` 和 `filter.dimensions[].code` 使用大写维度名：

| 维度 | 含义与可用筛选值 |
|---|---|
| `MAAS_TYPE` | `inference`、`training`、`model_units`、`capacity_reserved` |
| `BASE_MODEL` | 账单里的原始基础模型值，例如 `qwen-plus` |
| `API_KEY_ID` | 百炼账单里的 API Key ID，**不是密钥明文、Model Center 网关令牌或本地 token ID** |
| `WORKSPACE_ID` | 阿里云业务空间 ID，不是本项目工作区路径 |
| `FEE_TYPE` | `billing`、`subscription` |
| `CHARGE_TYPE` | `postpaid`、`prepaid` |
| `BUSINESS_REGION` | 实际业务地域，例如 `cn-beijing`、`ap-southeast-1`、`cn-hongkong` |
| `SERVICE_SITE` | 实际站点，例如 `asia-pacific-china`、`global`、`international` |
| `ARTICLE_CODE` | 实际商品 Code，例如 `sfm_inferenceglobal_public_intl` |

所有维度的 `values` 都允许 `DIMENSION_FILTER_NULL_VALUE`，表示匹配 NULL 或空字符串，不代表字符串字面量 `null`。

下面仅展示按基础模型分组的逻辑参数，**不是可直接发送的 GET JSON body**；实际 Query 编码或 SDK 参数映射必须按官方传输契约确认：

```json
{
  "billMonth": "2026-08",
  "groupBy": [{ "code": "BASE_MODEL" }],
  "topNum": 20,
  "zeroFilter": true,
  "regionId": "cn-beijing",
  "locale": "zh-CN"
}
```

| 返回字段 | 本项目处理要求 |
|---|---|
| `requestId/code/message/success` | 检查 HTTP 和业务状态，保留排错 ID；错误或未授权不能展示为零费用 |
| `data.currency` | 使用实际币种，不硬编码美元；不同币种的费用不能直接求和 |
| `data.totalAmount` | 含税总费用，金额字符串；展示为“月度账单”，不写入余额或本地请求估算成本 |
| `data.pretaxAmount/taxAmount` | 税前费用/税费，保留原始十进制精度 |
| `data.groups[].key/name/articleCodes/amount` | 分组键、展示名、商品列表和金额；空维度以 `DIMENSION_FILTER_NULL_VALUE` 表示 |
| `data.groups[].percentage` | 用户提供与英文资料定义为该组占 TopN 金额合计的比例；`0.10` 显示 10%，不能当作占整月总额的比例 |

TopN 分组不是全量明细，不能用分组金额之和替代 `totalAmount`，也不能据此补造未返回的模型记录。分别按模型、API Key、业务空间查询会得到重叠的统计视图，不能将这些视图相加。官方账单可能包含绕过本平台的调用、税费或订阅费用；它与本平台请求日志估算属于不同口径，不得混入同一累计值。需要对账时，明确月份、地域、站点、Workspace、上游 API Key ID 和费用类型等筛选范围。

### 下一次 Agent 的实施与更新流程

1. **先核实契约。** 重读本节和官方资料，解决账单 Host/鉴权/复杂参数编码、`selectType` 差异、价格币种与缓存计费项等未决问题。没有证据的字段保持未知，不编造可运行地址或价格。
2. **显式分离数据源。** 用 `presetKey` 和已审查身份表识别百炼，兼容 `bailian-openai`、`qwen-coder-openai`、`bailian-responses`、`bailian-anthropic`、`bailian-for-coding-openai`、`bailian-for-coding-anthropic` 等旧 slug；禁止仅按 `qwen` 字符串或相似域名归类。已有供应商 ID、Key、端点、模型启停和路由不自动改写。
3. **实现官方适配器。** 在现有模型同步服务之外区分官方目录地址、调用端点与账单地址；按配置的地域/空间获取所有页并保存完整元数据。账单凭据与模型 API Key 的复用必须有官方依据，所有凭据仅在服务端处理。
4. **迁移自动定价选择。** 同步修改 `lib/pricing/bundled.ts`、相关迁移、模型管理 API、恢复自动定价与导入导出行为，保证百炼不再命中 `cc-switch-provider/cc-switch-global` 回退；保留其他供应商使用的全局 Qwen/DeepSeek 等定价，不能按模型名前缀整批删除。官方适配器生效前不提前删除当前兼容数据。
5. **保留完整覆盖账本。** CC Switch 原始百炼记录仍需审计留存；未来生成时从运行时 CC Switch 供应商输出中明确排除，用既有 `excluded` 状态和可追溯原因（建议 `official-source:aliyun-modelstudio`）记录每条原始记录。保证 included/merged/excluded 唯一归属，不静默跳过、不重复生成同一厂商卡片。历史快照和新基线分别保留，先补测试再更新数量断言。
6. **记录官方快照。** 保存来源 URL、契约版本（若有）、抓取时间、内容校验值、行数及不含秘密的筛选范围。私有账单、真实 Key/Workspace 标识和原始账户数据不要提交 Git；fixture 使用合成数据。官方同步失败时保留上一次成功结果并标记过期/失败，不能清空为零或悄悄回退 CC Switch。
7. **验证后更新文档状态。** 至少覆盖模型多页/重复页/异常页、非 TG 模型、跨区域同名模型、四档缺价、零价、非 Token 计费、阶梯/币种、手动价保护、账单单维度和 TopN、空维度、`zeroFilter=false`、两套 `selectType` 的确认结果、鉴权失败以及既有 slug/端点不变性。再运行同步 `--check`、`npm test`、TypeScript 检查、生产构建和 `git diff --check`，最后将“待实现/待核实”逐项更新为有证据的状态。

这项来源决策不要求增加运行时 GitHub 联网、后台定时任务或同步按钮。触发方式应在实际实现任务中明确，本次没有新增这些行为。

## 检查、测试与差异审查

生成后依次执行：

```bash
npm run sync:cc-switch -- --source /tmp/cc-switch-sync --ref <SHA> --check
npm test
npx tsc --noEmit --incremental false
npm run build
git diff -- lib/presets/cc-switch.ts lib/presets/cc-switch-catalog.json lib/presets/cc-switch-manifest.json lib/pricing/cc-switch.ts public/logos
```

审查至少确认：SHA 和 blob SHA 正确；10 类来源都存在；255 个低层变体、82 个逻辑服务商、9 次语义合并和逻辑候选/旧 slug 覆盖均符合基线；数量变化有上游证据；覆盖账本闭合；canonical slug 无重复；OAuth-only 项在订阅目录中完整呈现且未实现项保持禁用；非 OAuth 不支持项仍被禁用；定价 repair 后数量和关键价格正确；图标数量及 checksum 正确；重复运行 `--check` 无差异。

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
