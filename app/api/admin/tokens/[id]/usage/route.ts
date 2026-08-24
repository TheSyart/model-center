import { NextRequest, NextResponse } from 'next/server';
import { getToken, spentInWindow, type SpendWindow } from '@/lib/services/token';

// GET /api/admin/tokens/:id/usage：窗口内已用金额
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = getToken(id);
  if (!token) return NextResponse.json({ error: '令牌不存在' }, { status: 404 });
  const window = (token.spendWindow as SpendWindow | null) ?? 'total';
  return NextResponse.json({
    token_id: id,
    spend_limit: token.spendLimit,
    spend_window: token.spendLimit != null ? window : null,
    spent: spentInWindow(token.id, window),
  });
}
