import { integer, real, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// 服务商（文档 §6）
export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  protocol: text('protocol').notNull(), // 'openai' | 'openai-responses' | 'anthropic' | 'gemini'
  baseUrl: text('base_url').notNull(),
  apiKeyEnc: text('api_key_enc').notNull(), // AES-GCM 密文
  enabled: integer('enabled').notNull().default(1),
  priority: integer('priority').notNull().default(0),
  balanceConfig: text('balance_config'), // JSON: {endpoint, method, json_path, unit}
  remark: text('remark'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
});

// 模型（同步或手动添加）
export const models = sqliteTable(
  'models',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    modelId: text('model_id').notNull(),
    alias: text('alias'),
    displayName: text('display_name'),
    enabled: integer('enabled').notNull().default(1),
    inputPrice: real('input_price'),
    outputPrice: real('output_price'),
    cacheReadPrice: real('cache_read_price'),
    cacheWritePrice: real('cache_write_price'),
    pricingSource: text('pricing_source'),
    pricingSourceRef: text('pricing_source_ref'),
    pricingSyncedAt: integer('pricing_synced_at'),
    contextWindow: integer('context_window'),
    synced: integer('synced').notNull().default(0),
  },
  (t) => [uniqueIndex('uq_models_provider_model').on(t.providerId, t.modelId)],
);

// 路由别名（虚拟模型 → 实际模型，支持 failover 列表）
export const routeAliases = sqliteTable('route_aliases', {
  id: text('id').primaryKey(),
  alias: text('alias').notNull().unique(),
  targets: text('targets').notNull(), // JSON: [{provider_id, model_id}, ...]
  enabled: integer('enabled').notNull().default(1),
});

// 预设提示词
export const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  content: text('content').notNull(),
  description: text('description'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
});

// 请求日志（不存请求体全文，只记元数据，§10）
export const requestLogs = sqliteTable(
  'request_logs',
  {
    id: text('id').primaryKey(),
    ts: integer('ts').notNull(),
    providerId: text('provider_id'),
    modelId: text('model_id'),
    alias: text('alias'),
    promptId: text('prompt_id'),
    status: integer('status'),
    latencyMs: integer('latency_ms'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    cost: real('cost'),
    error: text('error'),
    stream: integer('stream'),
    tokenId: text('token_id'), // 本次调用使用的网关令牌 id
    entryProtocol: text('entry_protocol'),
    source: text('source'),
    clientKey: text('client_key'),
    clientName: text('client_name'),
    tokenName: text('token_name'),
    tokenPrefix: text('token_prefix'),
    uncachedInputTokens: integer('uncached_input_tokens'),
    cacheReadTokens: integer('cache_read_tokens'),
    cacheWriteTokens: integer('cache_write_tokens'),
    cacheMetricsObserved: integer('cache_metrics_observed'),
    firstTokenMs: integer('first_token_ms'),
    durationMs: integer('duration_ms'),
  },
  (t) => [
    index('idx_logs_ts').on(t.ts),
    index('idx_logs_token_ts').on(t.tokenId, t.ts),
    index('idx_logs_provider_ts').on(t.providerId, t.ts),
    index('idx_logs_model_ts').on(t.modelId, t.ts),
    index('idx_logs_entry_ts').on(t.entryProtocol, t.ts),
  ],
);

// 按本地自然日聚合的长期用量；维度空值以空字符串保存，保证唯一索引可稳定 upsert。
export const usageDaily = sqliteTable(
  'usage_daily',
  {
    id: text('id').primaryKey(),
    day: text('day').notNull(),
    tokenId: text('token_id').notNull().default(''),
    tokenName: text('token_name'),
    tokenPrefix: text('token_prefix'),
    providerId: text('provider_id').notNull().default(''),
    providerName: text('provider_name'),
    providerSlug: text('provider_slug'),
    modelId: text('model_id').notNull().default(''),
    entryProtocol: text('entry_protocol').notNull().default(''),
    requests: integer('requests').notNull().default(0),
    success: integer('success').notNull().default(0),
    inputTokens: integer('input_tokens').notNull().default(0),
    uncachedInputTokens: integer('uncached_input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    effectiveTokens: integer('effective_tokens').notNull().default(0),
    cost: real('cost').notNull().default(0),
    pricedRequests: integer('priced_requests').notNull().default(0),
    durationTotalMs: integer('duration_total_ms').notNull().default(0),
    durationCount: integer('duration_count').notNull().default(0),
    firstTokenTotalMs: integer('first_token_total_ms').notNull().default(0),
    firstTokenCount: integer('first_token_count').notNull().default(0),
    cacheObservedRequests: integer('cache_observed_requests').notNull().default(0),
  },
  (t) => [
    uniqueIndex('uq_usage_daily_dimensions').on(t.day, t.tokenId, t.providerId, t.modelId, t.entryProtocol),
    index('idx_usage_daily_day').on(t.day),
    index('idx_usage_daily_token_day').on(t.tokenId, t.day),
    index('idx_usage_daily_provider_day').on(t.providerId, t.day),
    index('idx_usage_daily_model_day').on(t.modelId, t.day),
  ],
);

// 网关令牌（多令牌 + 限额）
export const gatewayTokens = sqliteTable('gateway_tokens', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  keyEnc: text('key_enc').notNull(), // AES-GCM 密文（查看/复制用）
  keyHash: text('key_hash').notNull(), // sha256(明文)，网关鉴权比对用
  prefix: text('prefix').notNull(), // 展示用前缀，如 mc-a1b2c3d4
  enabled: integer('enabled').notNull().default(1),
  expiresAt: integer('expires_at'), // null = 永不过期
  spendLimit: real('spend_limit'), // 限额金额（按 request_logs.cost 聚合；null = 不限）
  spendWindow: text('spend_window'), // 'day' | 'week' | 'month' | 'total'
  createdAt: integer('created_at'),
});

// 余额查询快照
export const balanceSnapshots = sqliteTable('balance_snapshots', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  ts: integer('ts').notNull(),
  raw: text('raw'),
  summary: text('summary'),
});

// 全局设置（单行 KV：log_retention_days、allow_http_providers 等）
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});
