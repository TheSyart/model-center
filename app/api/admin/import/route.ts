import { NextRequest, NextResponse } from 'next/server';
import { importConfig } from '@/lib/services/transfer';

// POST /api/admin/import：导入配置（冲突跳过并报告）
export async function POST(req: NextRequest) {

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || ![1, 2, 3].includes(Number(body.version))) {
    return NextResponse.json({ error: '不是合法的导出文件（仅支持 version: 1、2 或 3）' }, { status: 400 });
  }
  try {
    const report = importConfig(body);
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    return NextResponse.json({ error: `导入失败: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
  }
}
