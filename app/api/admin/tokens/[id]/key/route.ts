import { NextRequest, NextResponse } from 'next/server';
import { getToken, getTokenPlaintext } from '@/lib/services/token';

// GET /api/admin/tokens/:id/key：查看令牌明文（同 provider key 模式）
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = getToken(id);
  if (!token) return NextResponse.json({ error: '令牌不存在' }, { status: 404 });
  return NextResponse.json({ key: getTokenPlaintext(token) }, { headers: { 'Cache-Control': 'no-store' } });
}
