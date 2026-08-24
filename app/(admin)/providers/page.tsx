import { listProviders, serializeProvider } from '@/lib/services/provider';
import { PageHeader } from '@/components/page-header';
import ProvidersClient from './providers-client';

export const dynamic = 'force-dynamic';

export default function ProvidersPage() {
  // 服务端预取初始列表（SSR 直出，含 logo img），客户端组件接管后续交互
  const initialProviders = listProviders().map((provider) => serializeProvider(provider));
  return (
    <div>
      <PageHeader heading="服务商" description="连接上游模型服务，管理凭据、套餐额度和可调用模型。" />
      <ProvidersClient initialProviders={initialProviders} />
    </div>
  );
}
