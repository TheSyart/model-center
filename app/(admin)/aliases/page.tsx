import AliasesClient from './aliases-client';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default function AliasesPage() {
  return (
    <div>
      <PageHeader
        heading="路由别名"
        description={
          <>
            使用虚拟模型名（如 <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">best-coding</code>）组织按顺序降级的调用链。
          </>
        }
      />
      <AliasesClient />
    </div>
  );
}
