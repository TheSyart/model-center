import { NextRequest, NextResponse } from 'next/server';
import { queryLogs } from '@/lib/services/log';

// GET /api/admin/logs?provider=&model=&token=&client=&status=2xx|error&stream=1|0&from=&to=&q=&page=&page_size=
export async function GET(req: NextRequest) {

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(sp.get('page_size')) || 50));
  const num = (k: string) => {
    const v = Number(sp.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };

  const { logs, total } = queryLogs({
    provider: sp.get('provider') || undefined,
    model: sp.get('model') || undefined,
    token: sp.get('token') || undefined,
    client: sp.get('client') || undefined,
    status: sp.get('status') || undefined,
    stream: sp.get('stream') || undefined,
    from: num('from'),
    to: num('to'),
    q: sp.get('q') || undefined,
    page,
    pageSize,
  });
  return NextResponse.json({ logs, total, page, page_size: pageSize });
}
