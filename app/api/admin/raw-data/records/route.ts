import type { NextRequest } from 'next/server';

import {
  getDefaultRawDataAdminService,
  handleRawDataRecordsGet,
} from '@/lib/raw-capture/admin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return handleRawDataRecordsGet(request, getDefaultRawDataAdminService());
}
