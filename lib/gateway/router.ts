import { and, asc, desc, eq, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { ProviderRow } from '@/lib/services/provider';
import { GatewayError } from './errors';

export interface RouteTarget {
  provider: ProviderRow;
  /** 上游真实模型名 */
  modelId: string;
}

export interface ResolvedRoute {
  /** 按序尝试的目标列表（别名 failover：按 targets 顺序降级；其它解析方式恒为单目标） */
  targets: RouteTarget[];
  /** 请求使用的别名（若有；含 models.alias 命中与 route_aliases 命中） */
  alias: string | null;
  via: 'alias' | 'explicit' | 'bare';
}

interface AliasTarget {
  provider_id: string;
  model_id: string;
}

function notFound(message: string): GatewayError {
  return new GatewayError(404, message, 'model_not_found');
}

function findModelRow(providerId: string, modelId: string) {
  return db
    .select()
    .from(schema.models)
    .where(and(eq(schema.models.providerId, providerId), eq(schema.models.modelId, modelId)))
    .get();
}

function getProviderById(id: string): ProviderRow | undefined {
  return db.select().from(schema.providers).where(eq(schema.providers.id, id)).get();
}

/**
 * 模型解析（文档 §5.1）：model 字段三种形式按序解析——
 *  1. route_aliases 别名：返回 targets 中全部"服务商启用且模型未禁用"的目标（按序，供 failover 降级）；
 *  2. 'provider-slug/model' 显式格式：模型不必登记在 models 表（已登记且禁用则报错）；
 *  3. 全局裸模型名：匹配 models.model_id 或 models.alias，多服务商命中取 priority 最高。
 * 解析失败抛 GatewayError（404，OpenAI 错误格式由入口统一输出）。
 */
export function resolveModel(input: string): ResolvedRoute {
  // 1. 路由别名
  const aliasRow = db.select().from(schema.routeAliases).where(eq(schema.routeAliases.alias, input)).get();
  if (aliasRow) {
    if (aliasRow.enabled !== 1) {
      throw notFound(`路由别名 "${input}" 已禁用`);
    }
    let aliasTargets: AliasTarget[];
    try {
      aliasTargets = JSON.parse(aliasRow.targets);
    } catch {
      throw new GatewayError(500, `路由别名 "${input}" 的 targets 配置非法`, 'invalid_alias_config');
    }
    if (!Array.isArray(aliasTargets) || aliasTargets.length === 0) {
      throw new GatewayError(500, `路由别名 "${input}" 的 targets 为空`, 'invalid_alias_config');
    }
    const usable: RouteTarget[] = [];
    for (const t of aliasTargets) {
      const provider = getProviderById(t.provider_id);
      if (!provider || provider.enabled !== 1) continue;
      const m = findModelRow(provider.id, t.model_id);
      if (m && m.enabled !== 1) continue;
      usable.push({ provider, modelId: t.model_id });
    }
    if (usable.length === 0) {
      throw notFound(`路由别名 "${input}" 没有可用目标（服务商或模型已禁用）`);
    }
    return { targets: usable, alias: input, via: 'alias' };
  }

  // 2. 显式格式 provider-slug/model
  const slash = input.indexOf('/');
  if (slash > 0) {
    const slug = input.slice(0, slash);
    const modelId = input.slice(slash + 1);
    const provider = db.select().from(schema.providers).where(eq(schema.providers.slug, slug)).get();
    if (!provider) {
      throw notFound(`服务商 "${slug}" 不存在`);
    }
    if (provider.enabled !== 1) {
      throw notFound(`服务商 "${slug}" 已禁用`);
    }
    const m = findModelRow(provider.id, modelId);
    if (m && m.enabled !== 1) {
      throw notFound(`模型 "${modelId}" 已禁用`);
    }
    return { targets: [{ provider, modelId }], alias: null, via: 'explicit' };
  }

  // 3. 裸模型名：models.model_id 或 models.alias 全局匹配，取启用服务商中 priority 最高者；
  //    同优先级时先创建的服务商胜出，避免后接入的订阅服务商自动同步模型后抢占已有路由
  const rows = db
    .select({ model: schema.models, provider: schema.providers })
    .from(schema.models)
    .innerJoin(schema.providers, eq(schema.models.providerId, schema.providers.id))
    .where(
      and(
        eq(schema.providers.enabled, 1),
        or(eq(schema.models.modelId, input), eq(schema.models.alias, input)),
      ),
    )
    .orderBy(desc(schema.providers.priority), asc(schema.providers.createdAt))
    .all();
  const usable = rows.filter((r) => r.model.enabled === 1);
  if (usable.length === 0) {
    throw notFound(`模型 "${input}" 未找到（可用路由别名、provider/model 显式格式，或先在「模型」页登记）`);
  }
  const hit = usable[0];
  return {
    targets: [{ provider: hit.provider, modelId: hit.model.modelId }],
    alias: hit.model.alias === input ? input : null,
    via: 'bare',
  };
}
