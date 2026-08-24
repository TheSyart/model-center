import { NextRequest, NextResponse } from 'next/server';
import { createAlias, listAliases, serializeAlias, validateTargets } from '@/lib/services/alias';

// GET /api/admin/aliases：路由别名列表
export async function GET() {
  return NextResponse.json({ aliases: listAliases().map(serializeAlias) });
}

// POST /api/admin/aliases：新建路由别名（F11）
export async function POST(req: NextRequest) {

  let body: { alias?: string; targets?: unknown; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }
  const alias = body.alias?.trim();
  if (!alias) return NextResponse.json({ error: 'alias 不能为空' }, { status: 400 });
  if (!/^[\w][\w.-]*$/.test(alias)) {
    return NextResponse.json({ error: 'alias 只能包含字母、数字、下划线、连字符、点' }, { status: 400 });
  }
  const checked = validateTargets(body.targets);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  const row = createAlias({ alias, targets: checked.targets, enabled: body.enabled });
  if (row === 'conflict') return NextResponse.json({ error: `别名 "${alias}" 已被占用` }, { status: 409 });
  return NextResponse.json({ alias: serializeAlias(row) }, { status: 201 });
}
