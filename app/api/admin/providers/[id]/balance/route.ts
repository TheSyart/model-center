import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';
import { queryBalanceWithSnapshot } from '@/lib/services/balance';
import { getProvider } from '@/lib/services/provider';

// GET /api/admin/providers/:id/balance：查询余额（实时 + 写快照，§8）
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return NextResponse.json({ error: '服务商不存在' }, { status: 404 });

  const result = await queryBalanceWithSnapshot(provider, decrypt(provider.apiKeyEnc));
  return NextResponse.json(result);
}
