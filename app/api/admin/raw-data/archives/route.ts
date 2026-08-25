import {
  getDefaultRawDataAdminService,
  handleRawDataArchivesGet,
  handleRawDataArchivesPost,
} from '@/lib/raw-capture/admin';

export const runtime = 'nodejs';

export async function GET() {
  return handleRawDataArchivesGet(getDefaultRawDataAdminService());
}

export async function POST() {
  return handleRawDataArchivesPost(getDefaultRawDataAdminService());
}
