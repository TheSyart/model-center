import { NextRequest, NextResponse } from 'next/server';
import { deleteToken, getToken, serializeToken, SPEND_WINDOWS, updateToken, type SpendWindow } from '@/lib/services/token';

// PATCH /api/admin/tokens/:id：改名 / 启停 / 过期时间 / 限额
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: {
    name?: string;
    enabled?: boolean;
    expires_at?: number | null;
    spend_limit?: number | null;
    spend_window?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: 'name 不能为空' }, { status: 400 });
  }
  if (body.spend_limit !== undefined && body.spend_limit !== null && (typeof body.spend_limit !== 'number' || body.spend_limit <= 0)) {
    return NextResponse.json({ error: 'spend_limit 必须是正数或 null' }, { status: 400 });
  }
  if (body.spend_window !== undefined && body.spend_window !== null && !SPEND_WINDOWS.includes(body.spend_window as SpendWindow)) {
    return NextResponse.json({ error: `spend_window 必须是 ${SPEND_WINDOWS.join(' / ')}` }, { status: 400 });
  }

  const row = updateToken(id, {
    name: body.name?.trim(),
    enabled: body.enabled,
    expires_at: body.expires_at,
    spend_limit: body.spend_limit,
    spend_window: (body.spend_window as SpendWindow | null) ?? undefined,
  });
  if (!row) return NextResponse.json({ error: '令牌不存在' }, { status: 404 });
  return NextResponse.json({ token: serializeToken(row) });
}

// DELETE /api/admin/tokens/:id
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!deleteToken(id)) return NextResponse.json({ error: '令牌不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
