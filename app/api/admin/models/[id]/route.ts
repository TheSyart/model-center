import { NextRequest, NextResponse } from 'next/server';
import { deleteModel, getModelById, restoreModelPricing, serializeModel, updateModel } from '@/lib/services/model';
import { getProviderSubscriptionId } from '@/lib/services/provider';

const PRICING_FIELDS = ['input_price', 'output_price', 'cache_read_price', 'cache_write_price', 'restore_pricing'] as const;

interface PatchBody {
  alias?: string | null;
  display_name?: string | null;
  enabled?: boolean;
  input_price?: number | null;
  output_price?: number | null;
  cache_read_price?: number | null;
  cache_write_price?: number | null;
  restore_pricing?: boolean;
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
  const existing = getModelById(id);
  if (existing && getProviderSubscriptionId(existing.providerId) && PRICING_FIELDS.some((field) => body[field] !== undefined)) {
    return NextResponse.json({ error: '订阅账号模型不按 API 单价计费，不能设置定价' }, { status: 409 });
  }

  const row = body.restore_pricing ? restoreModelPricing(id) : updateModel(id, body);
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
