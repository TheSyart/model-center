import { NextRequest, NextResponse } from 'next/server';
import { testProviderConnection } from '@/lib/services/model';
import { getProvider, readProviderApiKey, rejectSubscriptionProviderAction } from '@/lib/services/provider';

// POST /api/admin/providers/:id/test：连通性测速（F10）
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return NextResponse.json({ error: '服务商不存在' }, { status: 404 });
  const blocked = rejectSubscriptionProviderAction(id); if (blocked) return blocked;

  const result = await testProviderConnection(provider, readProviderApiKey(provider));
  return NextResponse.json(result);
}
