# Model Center Agent 维护约束

修改服务商预设、模型目录、模型定价、厂商图标、余额查询或 Coding Plan 前，必须完整阅读 `docs/cc-switch-sync.md`。

厂商官方接口资料（网址、契约、计费、已确认「没有」的结论）集中在 `docs/vendor-apis/`，动手查任何厂商接口前先看那里，别重复调研。新增或修正时同步更新该条目的核对日期。

- `lib/presets/cc-switch.ts`、`lib/presets/cc-switch-catalog.json`、`lib/presets/cc-switch-manifest.json`、`lib/pricing/cc-switch.ts` 和同步来的 `public/logos/*` 是生成内容，禁止手工编辑。
- CC Switch 更新必须先解析 `main` 的 SHA，再以该不可变 SHA 生成；禁止在一次同步中混用 `main` 的不同时点。
- 保持 slug 稳定，不覆盖已有服务商的 Base URL、API Key、启用状态、优先级或备注。
- 每条上游预设必须出现在 included、merged 或 excluded 覆盖账本之一，不得静默丢弃。
- 提交前必须检查 manifest SHA、各来源数量、覆盖数量、192 条定价/新基线、图标数量和生成差异，并运行同步 `--check`、`npm test`、TypeScript 检查与生产构建。
- 上游结构或数量变化时，先补解析与测试，再更新断言和维护文档；不要为了让检查通过而直接改期望数字。

