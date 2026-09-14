import { NextResponse } from 'next/server';
import { queryBalanceWithSnapshot } from '@/lib/services/balance';
import { listProviders, getProviderSubscriptionId, readProviderApiKey } from '@/lib/services/provider';

// GET /api/admin/balances：并发查询所有启用服务商的余额（各自容错）
export async function GET() {

  const providers = listProviders().filter((p) => p.enabled === 1);
  const results = await Promise.allSettled(
    providers.map(async (p) => ({
      provider_id: p.id,
      slug: p.slug,
      name: p.name,
      result: getProviderSubscriptionId(p.id)
        ? { supported: false, error: '订阅账号额度请在订阅账号页面查询' }
        : await queryBalanceWithSnapshot(p, readProviderApiKey(p)),
    })),
  );
  return NextResponse.json({
    balances: results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            provider_id: providers[i].id,
            slug: providers[i].slug,
            name: providers[i].name,
            result: { supported: true, error: r.reason instanceof Error ? r.reason.message : String(r.reason) },
          },
    ),
  });
}
