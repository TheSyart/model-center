import DashboardClient from './dashboard-client';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader heading="仪表盘" description="查看聚合网关的请求、用量、成本与服务商状态。" />
      <DashboardClient />
    </div>
  );
}
