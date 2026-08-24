import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';
import { queryBalanceWithSnapshot } from '@/lib/services/balance';
import { listProviders } from '@/lib/services/provider';

// GET /api/admin/balances：并发查询所有启用服务商的余额（各自容错）
export async function GET() {

  const providers = listProviders().filter((p) => p.enabled === 1);
  const results = await Promise.allSettled(
    providers.map(async (p) => ({
      provider_id: p.id,
      slug: p.slug,
      name: p.name,
      result: await queryBalanceWithSnapshot(p, decrypt(p.apiKeyEnc)),
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
