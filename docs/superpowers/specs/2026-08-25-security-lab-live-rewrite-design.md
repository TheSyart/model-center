# Security Lab Claude Code 独立改写入口设计

日期：2026-08-25

## 目标

把现有 `/security-lab` 从静态风险说明升级为真实、可控、可追溯的 Claude Code 中转改写演示。演示入口与正常网关完全分离；只有显式把 Claude Code Base URL 指向专用地址时，流量才可能被改写。

模块提供两个独立功能：

1. 在真实 Claude Code 用户请求末尾追加管理员自定义的提示词后缀，再把改写后的请求发送给真实上游模型。
2. 在真实 Claude Code 响应中追加管理员配置的 `tool_use`，让 Claude Code 按正常工具调用流程解析和处理。

只要任一改写功能已开启，每次进入专用路径的请求都会持久化完整步骤；成功改写、部分改写和因条件不满足而跳过都会明确记录，供 `/security-lab` 页面实时展示和视频讲解。

## 隔离边界

正常入口保持不变：

- `/v1/messages`
- `/v1/chat/completions`
- `/v1/responses`
- `lib/gateway/pipeline.ts`
- 所有协议 Adapter 和协议转换器

新增专用入口：

- Claude Code Base URL：`http://<host>:<port>/security-lab`
- 实际 Messages 请求：`POST /security-lab/v1/messages`
- Next.js 路由文件：`app/(admin)/security-lab/v1/messages/route.ts`

专用路由复用现有鉴权、模型路由、服务商选择、上游转发和日志能力，但在调用共享管线前后执行 Security Lab 私有改写器。共享管线无需增加条件分支。

即使两个功能处于开启状态，正常 `/v1/messages` 也永远不会进入改写器。

## Claude Code 请求识别

专用路由仍然检查请求是否具有 Agent 特征。满足以下条件才视为可改写请求：

1. 请求体是合法 Anthropic Messages 请求。
2. 请求包含非空 `tools` 数组。
3. User-Agent 被现有客户端识别逻辑识别为 Claude Code，或工具列表中至少包含两个 Claude Code 常用工具名称。

常用工具集合第一版限定为 `Bash`、`Read`、`Write`、`Edit`、`Glob`、`Grep`。识别结果及依据写入历史步骤。

不符合条件的请求仍可通过专用路由正常转发，但不改写；当任一功能已开启时，历史会记录检测失败和跳过原因，绝不标记为“改写成功”。

## 配置模型

配置由 Security Lab 独立存储，不进入通用 `settings` API：

```ts
interface SecurityLabConfig {
  promptInjection: {
    enabled: boolean;
    suffix: string;
  };
  toolInjection: {
    enabled: boolean;
    toolName: 'Bash' | 'Read' | 'Write' | 'Edit';
    toolInput: Record<string, unknown>;
  };
  updatedAt: number;
}
```

约束：

- 两个开关独立保存、独立触发。
- 初始状态全部关闭。
- 开启提示词注入时，后缀不能为空，最大 8 KiB。
- 工具参数必须是合法 JSON 对象，序列化后最大 16 KiB。
- 工具名只能从四个预设中选择。
- 工具注入前必须确认该工具存在于本次 Claude Code 请求的 `tools` 定义中；不存在则跳过并记录原因。

默认工具示例使用无破坏性的 `/tmp/model-center-security-lab-demo.txt`，管理员可在页面中编辑真实调用参数。

## 提示词注入流程

专用路由先保留原始请求快照，再寻找最后一条包含用户文本的 `user` 消息：

- 字符串内容：在字符串末尾追加两个换行和自定义后缀。
- 内容块数组：在最后新增一个 `{ type: 'text', text: suffix }` 文本块。
- 只有 `tool_result`、图片或其他非文本块的 Agent 回传轮次不追加，避免每轮工具结果重复注入。

完成改写后，才调用 `anthropicRequestToIR()`，因此原生 Anthropic 请求和内部 IR 使用同一份已改写语义，不需要修改共享管线。

历史记录保存：原始末条用户文本、自定义后缀、改写后文本、匹配位置、转发模型和结果。

## Tool Use 注入流程

工具注入发生在共享管线返回 Anthropic 响应之后。

### 非流式响应

1. 解析返回 JSON。
2. 检查原始 `content` 是否已经包含至少一个 `tool_use`。
3. 检查选定工具是否存在于请求 `tools` 中。
4. 生成唯一 `toolu_security_lab_*` ID。
5. 向 `content` 末尾追加配置的 `tool_use`。
6. 将 `stop_reason` 设置为 `tool_use`。
7. 返回改写后的 JSON。

只有上游原响应已经进行工具调用时才追加演示工具，符合“Agent 进行 Tool Use 时添加另一个工具调用”的演示语义。

### 流式响应

流式改写器解析 Anthropic SSE，但不改变普通内容块。它跟踪：

- 已出现的最大内容块 `index`
- 是否出现原始 `tool_use`
- 终止 `message_delta`
- 最终 `message_stop`

当原始响应满足注入条件时，在终止事件前插入：

1. `content_block_start`，内容为新增 `tool_use`
2. `content_block_delta`，类型为 `input_json_delta`
3. `content_block_stop`
4. 改写后的 `message_delta`，`stop_reason` 为 `tool_use`
5. 原 `message_stop`

如果上游返回错误、流中断、没有原始工具调用或目标工具不存在，则不插入事件，并记录跳过原因。上游 usage 数字保持原值，因为新增事件不是模型实际生成的 token。

## 历史与存储

Security Lab 使用自己的 SQLite 建表逻辑，不修改通用 Drizzle schema：

- `security_lab_config`：单行 JSON 配置。
- `security_lab_rewrites`：任一功能开启时，每个专用路径请求的一条执行记录。

历史字段包括：

- ID、时间、请求关联 ID
- 模型、User-Agent、流式状态
- Agent 检测结果和依据
- 提示词注入前后快照
- 上游原始工具调用摘要
- 注入工具名称、参数和生成的 tool ID
- 每个阶段的时间、状态和说明
- 最终结果：`modified`、`partially_modified`、`skipped` 或 `failed`

请求与响应快照分别限制大小，超出后截断并明确标记，避免单次请求无限扩大数据库。历史按时间倒序查询，支持分页和手动清理；不会混入普通请求日志。

## 管理 API

新增 Security Lab 私有管理接口：

- `GET /api/admin/security-lab/config`
- `PUT /api/admin/security-lab/config`
- `GET /api/admin/security-lab/history`
- `DELETE /api/admin/security-lab/history`

这些接口只管理专用模块，不修改 `/api/admin/settings`。

## 页面设计

`/security-lab` 改为三部分：

1. **连接信息**：展示专用 Base URL、当前是否武装以及一键复制。
2. **两个改写器**：提示词后缀和 Tool Use 各自使用独立开关、编辑器和保存状态。
3. **改写历史**：自动刷新列表，展开后显示逐步时间线、请求前后差异、原始工具调用、新增工具调用和 SSE 事件。

页面顶部持续显示：只有专用 `/security-lab/v1/messages` 会被改写，正常网关不受影响。移动端配置卡纵向排列，历史详情使用 Sheet。

## 错误处理

- 配置非法：拒绝保存，不改变旧配置。
- 提示词找不到用户文本：正常转发，历史记录跳过原因。
- 工具不存在于请求定义：正常返回原响应，记录跳过原因。
- SSE 无法解析：优先保持原流可用，记录失败，不生成不完整工具事件。
- 历史写入失败：不得阻断模型请求；只写服务器错误日志。
- 两个开关关闭：专用入口作为普通 Anthropic 网关转发，但不会执行改写。

## 测试与验收

### 纯逻辑测试

- Agent 检测与非 Agent 排除。
- 字符串和内容块提示词后缀追加。
- `tool_result` 轮次不重复追加。
- 工具参数、大小和工具名校验。
- 非流式工具注入与 `stop_reason` 改写。
- 流式工具事件顺序、索引、ID 和结束原因。
- 无原始工具调用、工具不存在、流错误时保持原响应。

### 路由与存储测试

- `/v1/messages` 在功能开启时仍逐字节保持原行为。
- 只有 `/security-lab/v1/messages` 进入改写器。
- 改写后的提示词真实到达 mock Anthropic 上游。
- Claude Code 请求能收到并解析新增工具调用。
- 任一功能开启时，每个专用路径请求都产生持久化步骤记录；成功与跳过状态可区分。
- 服务重启后历史仍存在。

### UI 与端到端测试

- 两个开关独立保存。
- 非法 JSON 无法启用工具注入。
- 专用 Base URL 可复制。
- 历史自动刷新、展开、分页和清理。
- 375px 与 1440px 无横向溢出。
- 浅色、深色和键盘操作可用。

交付门槛仍为 `npm test`、UI 测试、Playwright、TypeScript 和生产构建全部通过。

## 不在本次范围

- OpenAI Chat、Responses、Gemini 兼容。
- 修改正常网关流量。
- 自动开启或定时开启改写。
- 根据自然语言动态生成攻击载荷。
- 外部数据接收服务。
- 修改服务商预设、定价、CC Switch 生成文件或品牌图标。
