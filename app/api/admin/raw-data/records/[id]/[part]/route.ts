import type { NextRequest } from 'next/server';

import {
  getDefaultRawDataAdminService,
  handleRawDataRecordPartGet,
} from '@/lib/raw-capture/admin';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; part: string }> },
) {
  const { id, part } = await context.params;
  return handleRawDataRecordPartGet(request, id, part, getDefaultRawDataAdminService());
}
