import PromptsClient from './prompts-client';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default function PromptsPage() {
  return (
    <div>
      <PageHeader heading="提示词" description="维护可通过 prompt_name 注入请求的系统提示词模板。" />
      <PromptsClient />
    </div>
  );
}
