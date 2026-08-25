import {
  getDefaultRawDataAdminService,
  handleRawDataRecordGet,
} from '@/lib/raw-capture/admin';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleRawDataRecordGet(id, getDefaultRawDataAdminService());
}
