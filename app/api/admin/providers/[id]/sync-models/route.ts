import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';
import { getProvider } from '@/lib/services/provider';
import { syncModels } from '@/lib/services/model';

// POST /api/admin/providers/:id/sync-models：拉取上游模型列表并合并入库（F4）
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return NextResponse.json({ error: '服务商不存在' }, { status: 404 });

  try {
    const result = await syncModels(provider, decrypt(provider.apiKeyEnc));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: `同步失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
