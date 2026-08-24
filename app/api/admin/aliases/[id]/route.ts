import { NextRequest, NextResponse } from 'next/server';
import { deleteAlias, getAliasById, serializeAlias, updateAlias, validateTargets } from '@/lib/services/alias';

// GET /api/admin/aliases/:id
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = getAliasById(id);
  if (!row) return NextResponse.json({ error: '别名不存在' }, { status: 404 });
  return NextResponse.json({ alias: serializeAlias(row) });
}

// PATCH /api/admin/aliases/:id
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { alias?: string; targets?: unknown; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }
  if (body.alias !== undefined && (!body.alias.trim() || !/^[\w][\w.-]*$/.test(body.alias.trim()))) {
    return NextResponse.json({ error: 'alias 格式非法' }, { status: 400 });
  }
  let targets;
  if (body.targets !== undefined) {
    const checked = validateTargets(body.targets);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    targets = checked.targets;
  }

  const row = updateAlias(id, { alias: body.alias?.trim(), targets, enabled: body.enabled });
  if (row === 'conflict') return NextResponse.json({ error: `别名 "${body.alias}" 已被占用` }, { status: 409 });
  if (!row) return NextResponse.json({ error: '别名不存在' }, { status: 404 });
  return NextResponse.json({ alias: serializeAlias(row) });
}

// DELETE /api/admin/aliases/:id
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!deleteAlias(id)) return NextResponse.json({ error: '别名不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
