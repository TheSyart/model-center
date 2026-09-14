import { NextRequest, NextResponse } from 'next/server';
import { getProvider, readProviderApiKey, rejectSubscriptionProviderAction } from '@/lib/services/provider';

/**
 * GET /api/admin/providers/:id/key：返回解密后的 api_key 明文。
 * 仅管理员（session）可用；列表接口绝不返回明文，明文按需由此接口单独获取。
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return NextResponse.json({ error: '服务商不存在' }, { status: 404 });
  const blocked = rejectSubscriptionProviderAction(id); if (blocked) return blocked;
  return NextResponse.json(
    { api_key: readProviderApiKey(provider) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
