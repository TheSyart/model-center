import {
  getDefaultRawDataAdminService,
  handleRawDataArchiveDelete,
  handleRawDataArchiveGet,
} from '@/lib/raw-capture/admin';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ day: string }> }) {
  const { day } = await context.params;
  return handleRawDataArchiveGet(day, getDefaultRawDataAdminService());
}

export async function DELETE(_request: Request, context: { params: Promise<{ day: string }> }) {
  const { day } = await context.params;
  return handleRawDataArchiveDelete(day, getDefaultRawDataAdminService());
}
