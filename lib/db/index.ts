import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { encrypt } from '@/lib/crypto';
import * as schema from './schema';
import { migrateUsageSchema } from './usage-migration';
import { migrateModelPricingSchema } from './pricing-migration';
import { migrateProviderEndpointSchema } from './provider-endpoint-migration';
import { lookupBundledPricing } from '@/lib/services/model-pricing';
import ccSwitchManifest from '@/lib/presets/cc-switch-manifest.json';

// 数据目录：默认 <cwd>/data，可用 MODEL_CENTER_DB_DIR 覆盖（测试/多实例隔离用）
const DB_DIR = process.env.MODEL_CENTER_DB_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'model-center.db');

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS providers (
  id            TEXT PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  protocol      TEXT NOT NULL,
  base_url      TEXT NOT NULL,
  preset_key    TEXT,
  api_key_enc   TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  priority      INTEGER NOT NULL DEFAULT 0,
  balance_config TEXT,
  remark        TEXT,
  created_at    INTEGER,
  updated_at    INTEGER
);
CREATE TABLE IF NOT EXISTS provider_endpoints (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  protocol TEXT NOT NULL,
  base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  preset_variant_slug TEXT,
  source_ref TEXT,
  model_catalog_complete INTEGER NOT NULL DEFAULT 0,
  models_observed_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(provider_id, protocol)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_endpoints_provider_protocol ON provider_endpoints(provider_id, protocol);
CREATE INDEX IF NOT EXISTS idx_provider_endpoints_provider_default ON provider_endpoints(provider_id, is_default);
CREATE TABLE IF NOT EXISTS provider_endpoint_models (
  endpoint_id TEXT NOT NULL REFERENCES provider_endpoints(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  source TEXT NOT NULL,
  observed_at INTEGER,
  PRIMARY KEY(endpoint_id, model_id)
);
CREATE TABLE IF NOT EXISTS models (
  id            TEXT PRIMARY KEY,
  provider_id   TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_id      TEXT NOT NULL,
  alias         TEXT,
  display_name  TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  input_price   REAL,
  output_price  REAL,
  cache_read_price REAL,
  cache_write_price REAL,
  pricing_source TEXT,
  pricing_source_ref TEXT,
  pricing_synced_at INTEGER,
  context_window INTEGER,
  synced        INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_models_provider_model ON models(provider_id, model_id);
CREATE TABLE IF NOT EXISTS route_aliases (
  id         TEXT PRIMARY KEY,
  alias      TEXT UNIQUE NOT NULL,
  targets    TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS prompts (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  content     TEXT NOT NULL,
  description TEXT,
  created_at  INTEGER,
  updated_at  INTEGER
);
CREATE TABLE IF NOT EXISTS request_logs (
  id           TEXT PRIMARY KEY,
  ts           INTEGER NOT NULL,
  provider_id  TEXT,
  model_id     TEXT,
  alias        TEXT,
  prompt_id    TEXT,
  status       INTEGER,
  latency_ms   INTEGER,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  cost         REAL,
  error        TEXT,
  stream       INTEGER,
  client_key   TEXT,
  client_name  TEXT,
  provider_endpoint_id TEXT,
  upstream_protocol TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON request_logs(ts);
CREATE TABLE IF NOT EXISTS balance_snapshots (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  raw         TEXT,
  summary     TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS gateway_tokens (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  key_enc      TEXT NOT NULL,
  key_hash     TEXT NOT NULL,
  prefix       TEXT NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1,
  expires_at   INTEGER,
  spend_limit  REAL,
  spend_window TEXT,
  created_at   INTEGER
);
`;

function migrate(sqlite: Database.Database) {
  // request_logs 加 token_id 列（幂等：先查 PRAGMA table_info）
  const cols = sqlite.prepare('PRAGMA table_info(request_logs)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'token_id')) {
    sqlite.exec('ALTER TABLE request_logs ADD COLUMN token_id TEXT');
  }

  // 去登录：清理管理密码残留键（幂等）
  sqlite.prepare('DELETE FROM settings WHERE key = ?').run('admin_password_hash');

  // 旧版 settings.gateway_key → 迁移为「默认令牌」（无限制），原 key 继续有效
  const tokenCount = (sqlite.prepare('SELECT COUNT(*) AS n FROM gateway_tokens').get() as { n: number }).n;
  const legacyKey = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get('gateway_key') as
    | { value: string }
    | undefined;
  if (tokenCount === 0 && legacyKey?.value) {
    const plaintext = legacyKey.value;
    sqlite
      .prepare(
        'INSERT INTO gateway_tokens (id, name, key_enc, key_hash, prefix, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
      )
      .run(
        crypto.randomUUID(),
        '默认令牌',
        encrypt(plaintext),
        crypto.createHash('sha256').update(plaintext).digest('hex'),
        plaintext.slice(0, 10),
        Date.now(),
      );
    console.log('[db] 已将 settings.gateway_key 迁移为默认令牌');
  }
  if (legacyKey) {
    // 迁移后 gateway_key 不再被网关鉴权消费，删除残留键
    sqlite.prepare('DELETE FROM settings WHERE key = ?').run('gateway_key');
  }

  migrateUsageSchema(sqlite);
  migrateModelPricingSchema(sqlite, lookupBundledPricing, ccSwitchManifest.commit);
  migrateProviderEndpointSchema(sqlite);
}

function createClient() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  // next build 会多 worker 并发加载模块，加 busy_timeout 避免 SQLITE_BUSY
  sqlite.pragma('busy_timeout = 5000');
  // 首次启动建表（幂等）
  sqlite.exec(CREATE_TABLES_SQL);
  // 轻量迁移（加列 / gateway_key → 默认令牌 / 清理残留键）
  migrate(sqlite);
  // 首次启动（全新库、无令牌）生成初始令牌「默认令牌」
  const tokenCount = (sqlite.prepare('SELECT COUNT(*) AS n FROM gateway_tokens').get() as { n: number }).n;
  if (tokenCount === 0) {
    const plaintext = 'mc-' + crypto.randomBytes(24).toString('hex');
    sqlite
      .prepare(
        'INSERT INTO gateway_tokens (id, name, key_enc, key_hash, prefix, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
      )
      .run(
        crypto.randomUUID(),
        '默认令牌',
        encrypt(plaintext),
        crypto.createHash('sha256').update(plaintext).digest('hex'),
        plaintext.slice(0, 10),
        Date.now(),
      );
  }
  return { sqlite, drizzle: drizzle(sqlite, { schema }) };
}

// dev 模式 HMR 下缓存单例，避免重复打开数据库文件
const globalForDb = globalThis as unknown as { __modelCenterDb?: ReturnType<typeof createClient> };

// next build 的 page data 收集会在多个 worker 进程并发 import 本模块，
// 并发初始化同一 SQLite 文件会 SQLITE_BUSY；构建期只 import 不执行 handler，
// 因此构建阶段跳过 DB 初始化（导出占位，运行时不会走到）。
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

const client = IS_BUILD
  ? null
  : (globalForDb.__modelCenterDb ?? (globalForDb.__modelCenterDb = createClient()));

export const db = IS_BUILD ? (null as unknown as ReturnType<typeof createClient>['drizzle']) : client!.drizzle;
export const sqlite = IS_BUILD ? (null as unknown as Database.Database) : client!.sqlite;

export { schema };
