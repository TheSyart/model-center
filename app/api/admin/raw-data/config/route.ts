import type { NextRequest } from 'next/server';

import {
  getDefaultRawDataAdminService,
  handleRawDataConfigGet,
  handleRawDataConfigPut,
} from '@/lib/raw-capture/admin';

export const runtime = 'nodejs';

export async function GET() {
  return handleRawDataConfigGet(getDefaultRawDataAdminService());
}

export async function PUT(request: NextRequest) {
  return handleRawDataConfigPut(request, getDefaultRawDataAdminService());
}
