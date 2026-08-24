import { NextResponse } from 'next/server';
import { getStats } from '@/lib/services/log';

// GET /api/admin/stats：overview（今日/7日/30日）+ by_provider + by_model + trend（近14天）
export async function GET() {
  return NextResponse.json(getStats());
}
