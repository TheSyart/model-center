import crypto from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { prompts } from '@/lib/db/schema';

export type PromptRow = typeof prompts.$inferSelect;

/** {{var}} 占位符，变量名白名单字符 [a-zA-Z0-9_]（允许两侧空白）。 */
const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export interface RenderResult {
  text: string;
  /** 未在 vars 中提供、保留原样的变量名 */
  missing: string[];
}

/**
 * 渲染提示词：{{var}} 用 vars 替换；未提供的变量保留原样并记入 missing。
 */
export function renderPrompt(content: string, vars?: Record<string, unknown> | null): RenderResult {
  const missing = new Set<string>();
  const text = content.replace(VAR_RE, (raw, name: string) => {
    if (vars && Object.prototype.hasOwnProperty.call(vars, name)) {
      return String(vars[name]);
    }
    missing.add(name);
    return raw;
  });
  return { text, missing: [...missing] };
}

/** 提取 content 中引用的全部变量名（去重，供前端展示）。 */
export function extractVars(content: string): string[] {
  const vars = new Set<string>();
  for (const m of content.matchAll(VAR_RE)) {
    vars.add(m[1]);
  }
  return [...vars];
}

export function serializePrompt(p: PromptRow) {
  return {
    id: p.id,
    name: p.name,
    content: p.content,
    description: p.description,
    vars: extractVars(p.content),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function listPrompts(): PromptRow[] {
  return db.select().from(schema.prompts).orderBy(asc(schema.prompts.createdAt)).all();
}

export function getPromptById(id: string): PromptRow | undefined {
  return db.select().from(schema.prompts).where(eq(schema.prompts.id, id)).get();
}

export function getPromptByName(name: string): PromptRow | undefined {
  return db.select().from(schema.prompts).where(eq(schema.prompts.name, name)).get();
}

/** 创建；name 冲突返回 null。 */
export function createPrompt(input: { name: string; content: string; description?: string | null }): PromptRow | null {
  const now = Date.now();
  const row: PromptRow = {
    id: crypto.randomUUID(),
    name: input.name,
    content: input.content,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    db.insert(schema.prompts).values(row).run();
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) return null;
    throw e;
  }
  return row;
}

/** 更新；name 冲突返回 'conflict'，不存在返回 null。 */
export function updatePrompt(
  id: string,
  input: { name?: string; content?: string; description?: string | null },
): PromptRow | null | 'conflict' {
  const existing = getPromptById(id);
  if (!existing) return null;
  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.content !== undefined) updates.content = input.content;
  if (input.description !== undefined) updates.description = input.description || null;
  try {
    db.update(schema.prompts).set(updates).where(eq(schema.prompts.id, id)).run();
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) return 'conflict';
    throw e;
  }
  return getPromptById(id)!;
}

export function deletePrompt(id: string): boolean {
  if (!getPromptById(id)) return false;
  db.delete(schema.prompts).where(eq(schema.prompts.id, id)).run();
  return true;
}
