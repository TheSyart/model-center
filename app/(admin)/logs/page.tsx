import LogsClient from './logs-client';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default function LogsPage() {
  return (
    <div>
      <PageHeader heading="日志" description="追踪请求路由、Token 用量、耗时和上游错误。" />
      <LogsClient />
    </div>
  );
}
