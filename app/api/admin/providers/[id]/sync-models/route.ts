import { NextRequest, NextResponse } from 'next/server';
import { getProvider, readProviderApiKey, rejectSubscriptionProviderAction } from '@/lib/services/provider';
import { syncModels } from '@/lib/services/model';
import type { BailianCatalogFilterOptions } from '@/lib/services/bailian-catalog';

// POST /api/admin/providers/:id/sync-models：拉取上游模型列表并合并入库（F4）
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return NextResponse.json({ error: '服务商不存在' }, { status: 404 });
  const blocked = rejectSubscriptionProviderAction(id); if (blocked) return blocked;

  let filter: BailianCatalogFilterOptions | undefined;
  try {
    const json = await req.json();
    if (json && typeof json === 'object') {
      filter = json.filter ?? json;
    }
  } catch {
    // 允许空请求体
  }

  try {
    // 筛选同步是「按条件刷新列表」，所以本地已同步集合要与筛选结果一致；
    // 全量同步维持只增不删（上游下架的模型保留，仅统计）。
    const result = filter
      ? await syncModels(provider, readProviderApiKey(provider), filter, { prune: true })
      : await syncModels(provider, readProviderApiKey(provider));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: `同步失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
