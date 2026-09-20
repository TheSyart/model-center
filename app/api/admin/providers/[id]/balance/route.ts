import { NextRequest, NextResponse } from 'next/server';
import { queryBalanceWithSnapshot } from '@/lib/vendors/balance';
import { getProvider, readProviderApiKey, rejectSubscriptionProviderAction } from '@/lib/services/provider';

// GET /api/admin/providers/:id/balance：查询余额（实时 + 写快照，§8）
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return NextResponse.json({ error: '服务商不存在' }, { status: 404 });
  const blocked = rejectSubscriptionProviderAction(id); if (blocked) return blocked;

  const result = await queryBalanceWithSnapshot(provider, readProviderApiKey(provider));
  return NextResponse.json(result);
}
