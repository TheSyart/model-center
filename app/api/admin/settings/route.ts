import { NextRequest, NextResponse } from 'next/server';
import { getLogRetentionDays } from '@/lib/services/log';
import { getSetting, setSetting } from '@/lib/settings';

// GET /api/admin/settings：日志保留天数 + http provider 开关 + 余额自动刷新间隔
// （网关 Key 已升级为多令牌体系，见 /tokens 页与 /api/admin/tokens）
export async function GET() {
  const raw = getSetting('balance_refresh_seconds');
  const refresh = raw === null ? 60 : Number(raw);
  return NextResponse.json({
    log_retention_days: getLogRetentionDays(),
    allow_http_providers: getSetting('allow_http_providers') === '1',
    balance_refresh_seconds: Number.isFinite(refresh) && refresh >= 0 ? refresh : 60,
  });
}

// PUT /api/admin/settings：修改日志保留天数 / http provider 开关 / 余额刷新间隔
export async function PUT(req: NextRequest) {
  let body: {
    log_retention_days?: number;
    allow_http_providers?: boolean;
    balance_refresh_seconds?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }
  const out: Record<string, unknown> = {};
  if (body.log_retention_days !== undefined) {
    const days = Number(body.log_retention_days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return NextResponse.json({ error: 'log_retention_days 必须是 1-3650 的整数' }, { status: 400 });
    }
    setSetting('log_retention_days', String(days));
    out.log_retention_days = days;
  }
  if (body.allow_http_providers !== undefined) {
    setSetting('allow_http_providers', body.allow_http_providers ? '1' : '0');
    out.allow_http_providers = body.allow_http_providers;
  }
  if (body.balance_refresh_seconds !== undefined) {
    const secs = Number(body.balance_refresh_seconds);
    if (!Number.isInteger(secs) || secs < 0 || secs > 86400) {
      return NextResponse.json({ error: 'balance_refresh_seconds 必须是 0-86400 的整数（0 = 关闭自动刷新）' }, { status: 400 });
    }
    setSetting('balance_refresh_seconds', String(secs));
    out.balance_refresh_seconds = secs;
  }
  if (Object.keys(out).length === 0) {
    return NextResponse.json({ error: '无可执行的操作' }, { status: 400 });
  }
  return NextResponse.json(out);
}
