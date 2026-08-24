import { NextRequest, NextResponse } from 'next/server';
import {
  createToken,
  listTokens,
  serializeToken,
  SPEND_WINDOWS,
  spentInWindow,
  type SpendWindow,
} from '@/lib/services/token';

// GET /api/admin/tokens：令牌列表（含窗口内已用金额）
export async function GET() {
  const tokens = listTokens().map((t) =>
    serializeToken(t, t.spendLimit != null ? spentInWindow(t.id, (t.spendWindow as SpendWindow) ?? 'total') : undefined),
  );
  return NextResponse.json({ tokens });
}

interface CreateBody {
  name?: string;
  expires_at?: number | null;
  spend_limit?: number | null;
  spend_window?: string | null;
}

// POST /api/admin/tokens：创建令牌（明文仅在创建响应中返回一次；之后可用 key 接口查看）
export async function POST(req: NextRequest) {
  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: 'name 不能为空' }, { status: 400 });
  if (body.spend_limit != null) {
    if (typeof body.spend_limit !== 'number' || body.spend_limit <= 0) {
      return NextResponse.json({ error: 'spend_limit 必须是正数' }, { status: 400 });
    }
    if (body.spend_window && !SPEND_WINDOWS.includes(body.spend_window as SpendWindow)) {
      return NextResponse.json({ error: `spend_window 必须是 ${SPEND_WINDOWS.join(' / ')}` }, { status: 400 });
    }
  }
  if (body.expires_at != null && (typeof body.expires_at !== 'number' || body.expires_at <= Date.now())) {
    return NextResponse.json({ error: 'expires_at 必须是将来的毫秒时间戳' }, { status: 400 });
  }

  const { row, plaintext } = createToken({
    name,
    expires_at: body.expires_at ?? null,
    spend_limit: body.spend_limit ?? null,
    spend_window: (body.spend_window as SpendWindow) ?? null,
  });
  return NextResponse.json({ token: serializeToken(row), key: plaintext }, { status: 201 });
}
