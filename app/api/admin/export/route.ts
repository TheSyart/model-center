import { NextRequest, NextResponse } from 'next/server';
import { exportConfig } from '@/lib/services/transfer';

// GET /api/admin/export?include_keys=1：导出全部配置（api_key 默认脱敏为 ***）
export async function GET(req: NextRequest) {
  const includeKeys = req.nextUrl.searchParams.get('include_keys') === '1';
  const config = exportConfig(includeKeys);
  const filename = `model-center-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(config, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
