import { NextRequest, NextResponse } from 'next/server';
import { deleteModel, serializeModel, updateModel } from '@/lib/services/model';

interface PatchBody {
  alias?: string | null;
  display_name?: string | null;
  enabled?: boolean;
  input_price?: number | null;
  output_price?: number | null;
  context_window?: number | null;
}

// PATCH /api/admin/models/:id：启停/别名/单价/上下文窗口
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }
  if (body.alias && !/^[\w][\w./-]*$/.test(body.alias)) {
    return NextResponse.json({ error: 'alias 格式非法' }, { status: 400 });
  }

  const row = updateModel(id, body);
  if (row === 'alias_conflict') {
    return NextResponse.json({ error: `别名 "${body.alias}" 已被占用` }, { status: 409 });
  }
  if (!row) return NextResponse.json({ error: '模型不存在' }, { status: 404 });
  return NextResponse.json({ model: serializeModel(row) });
}

// DELETE /api/admin/models/:id
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!deleteModel(id)) return NextResponse.json({ error: '模型不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
