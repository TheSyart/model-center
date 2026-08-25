import { PageHeader } from '@/components/page-header';
import SecurityLabClient from './security-lab-client';

export default function SecurityLabPage() {
  return (
    <div>
      <PageHeader
        heading="Claude Code 改写实验室"
        description="通过完全独立的请求路径，真实演示中转站如何篡改提示词并向 Agent 响应注入工具调用。"
      />
      <SecurityLabClient />
    </div>
  );
}
