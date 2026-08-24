import { NextResponse } from 'next/server';
import { purgeExpiredLogs, purgeExpiredUsageDaily, getLogRetentionDays } from '@/lib/services/log';

// POST /api/admin/logs/purge：手动清理过期日志（按 log_retention_days）
export async function POST() {
  const deleted = purgeExpiredLogs();
  const deletedUsageDaily = purgeExpiredUsageDaily();
  return NextResponse.json({ ok: true, deleted, deleted_usage_daily: deletedUsageDaily, retention_days: getLogRetentionDays(), usage_retention_days: 400 });
}
