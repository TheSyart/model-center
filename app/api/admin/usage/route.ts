import { NextRequest, NextResponse } from 'next/server';
import { getUsage } from '@/lib/services/usage';
import { normalizeUsageRangeForBucket, validateUsageRange } from '@/lib/services/usage-metrics';

// GET /api/admin/usage?from=&to=&bucket=hour|day&token=&provider=&model=
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const now = Date.now();
  const date = new Date(now);
  const defaultFrom = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const from = params.has('from') ? Number(params.get('from')) : defaultFrom;
  const to = params.has('to') ? Number(params.get('to')) : now;
  const validation = validateUsageRange(from, to, params.get('bucket') ?? 'hour');
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const normalized = normalizeUsageRangeForBucket(validation.from, validation.to, validation.bucket);
  const normalizedValidation = validateUsageRange(normalized.from, normalized.to, normalized.bucket);
  if (!normalizedValidation.ok) return NextResponse.json({ error: normalizedValidation.error }, { status: 400 });

  return NextResponse.json(
    getUsage({
      from: normalizedValidation.from,
      to: normalizedValidation.to,
      bucket: normalizedValidation.bucket,
      token: params.get('token') || undefined,
      provider: params.get('provider') || undefined,
      model: params.get('model') || undefined,
    }),
  );
}
