import TokensClient from './tokens-client';
import { PageHeader } from '@/components/page-header';
import GatewayEndpoints from './gateway-endpoints';

export const dynamic = 'force-dynamic';

export default function TokensPage() {
  return (
    <div>
      <PageHeader heading="令牌" description="配置客户端接入地址，并管理访问凭据、有效期与花费限额。" />
      <GatewayEndpoints />
      <TokensClient />
    </div>
  );
}
