import type Database from 'better-sqlite3';
import ccSwitchManifest from '@/lib/presets/cc-switch-manifest.json';
import { lookupBundledPricing } from '@/lib/pricing/bundled';
import { migrateSubscriptionSchema } from '@/lib/subscriptions/store';
import { migrateModelCapabilitiesSchema } from './capabilities-migration';
import { migrateModelReasoningSchema } from './model-reasoning-migration';
import { migrateModelPricingSchema } from './pricing-migration';
import { migrateProviderCatalogSchema } from './provider-catalog-migration';
import { migrateProviderEndpointSchema } from './provider-endpoint-migration';
import { migrateUsageSchema } from './usage-migration';

/**
 * 迁移链的组装处。
 *
 * 这是一个**组装层**（composition root）：它的职责就是知道有哪些迁移、按什么顺序跑、
 * 各自需要什么依赖，因此允许它向上 import 业务模块。除它之外，lib/db 下的任何文件
 * 都不应该 import lib/services 或 lib/subscriptions。
 *
 * 之所以要单独拆出来：此前这段直接写在 index.ts 里，于是最底层的数据库模块
 * 为了拿 lookupBundledPricing 和 migrateSubscriptionSchema，反过来依赖了业务层。
 *
 * migrateSubscriptionSchema 留在 lib/subscriptions/store.ts 是刻意的——它要做
 * 强度变体折叠，真的需要订阅领域的逻辑（variants.ts），搬进 lib/db 只会把
 * 依赖问题换个方向再来一遍。让它在这里被显式注册，比藏在别处好。
 *
 * 顺序有意义：
 *  1. usage 先跑，它创建 usage_daily 与历史回填；
 *  2. pricing 依赖 models 的价格列；
 *  3. provider-endpoint 的回填依赖 providers.preset_key；
 *  4. subscription 最后，它可能重建 subscription_accounts（需要自己的事务）。
 */
export function runMigrations(sqlite: Database.Database): void {
  migrateUsageSchema(sqlite);
  migrateModelPricingSchema(sqlite, lookupBundledPricing, ccSwitchManifest.commit);
  migrateModelReasoningSchema(sqlite);
  migrateModelCapabilitiesSchema(sqlite);
  migrateProviderCatalogSchema(sqlite);
  migrateProviderEndpointSchema(sqlite);
  migrateSubscriptionSchema(sqlite);
}
