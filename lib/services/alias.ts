import crypto from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { routeAliases } from '@/lib/db/schema';
import { aliasTaken } from './model';

export type AliasRow = typeof routeAliases.$inferSelect;

export interface AliasTarget {
  provider_id: string;
  model_id: string;
}

export function serializeAlias(a: AliasRow) {
  let targets: AliasTarget[] = [];
  try {
    targets = JSON.parse(a.targets);
  } catch {
    // 忽略
  }
  return { id: a.id, alias: a.alias, targets, enabled: a.enabled === 1 };
}

export function listAliases(): AliasRow[] {
  return db.select().from(schema.routeAliases).orderBy(asc(schema.routeAliases.alias)).all();
}

export function getAliasById(id: string): AliasRow | undefined {
  return db.select().from(schema.routeAliases).where(eq(schema.routeAliases.id, id)).get();
}

/** 校验 targets：非空数组，元素 {provider_id, model_id}，provider 与 model（该 provider 下已登记）必须存在。 */
export function validateTargets(targets: unknown): { ok: true; targets: AliasTarget[] } | { ok: false; error: string } {
  if (!Array.isArray(targets) || targets.length === 0) {
    return { ok: false, error: 'targets 必须是非空数组' };
  }
  for (const [i, t] of targets.entries()) {
    if (!t || typeof t.provider_id !== 'string' || typeof t.model_id !== 'string' || !t.model_id) {
      return { ok: false, error: `targets[${i}] 需要 {provider_id, model_id}` };
    }
    const provider = db.select().from(schema.providers).where(eq(schema.providers.id, t.provider_id)).get();
    if (!provider) return { ok: false, error: `targets[${i}] 引用的服务商不存在` };
    const model = db
      .select()
      .from(schema.models)
      .where(eq(schema.models.providerId, t.provider_id))
      .all()
      .find((m) => m.modelId === t.model_id);
    if (!model) return { ok: false, error: `targets[${i}] 引用的模型 "${t.model_id}" 未在该服务商下登记` };
  }
  return { ok: true, targets: targets as AliasTarget[] };
}

/** 创建；alias 冲突返回 'conflict'。 */
export function createAlias(input: { alias: string; targets: AliasTarget[]; enabled?: boolean }): AliasRow | 'conflict' {
  if (aliasTaken(input.alias)) return 'conflict';
  const row: AliasRow = {
    id: crypto.randomUUID(),
    alias: input.alias,
    targets: JSON.stringify(input.targets),
    enabled: input.enabled === false ? 0 : 1,
  };
  db.insert(schema.routeAliases).values(row).run();
  return row;
}

/** 更新；不存在返回 null，alias 冲突返回 'conflict'。 */
export function updateAlias(
  id: string,
  input: { alias?: string; targets?: AliasTarget[]; enabled?: boolean },
): AliasRow | null | 'conflict' {
  const existing = getAliasById(id);
  if (!existing) return null;
  if (input.alias && input.alias !== existing.alias && aliasTaken(input.alias)) return 'conflict';
  const updates: Record<string, unknown> = {};
  if (input.alias !== undefined) updates.alias = input.alias;
  if (input.targets !== undefined) updates.targets = JSON.stringify(input.targets);
  if (input.enabled !== undefined) updates.enabled = input.enabled ? 1 : 0;
  db.update(schema.routeAliases).set(updates).where(eq(schema.routeAliases.id, id)).run();
  return getAliasById(id)!;
}

export function deleteAlias(id: string): boolean {
  if (!getAliasById(id)) return false;
  db.delete(schema.routeAliases).where(eq(schema.routeAliases.id, id)).run();
  return true;
}
