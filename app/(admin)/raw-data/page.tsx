import { PageHeader } from '@/components/page-header';
import RawDataClient from './raw-data-client';

export default function RawDataPage() {
  return (
    <div>
      <PageHeader
        heading="原始数据"
        description="展示中转站能够完整留存用户对话并按日打包的风险；所有数据只保存在本机。"
      />
      <RawDataClient />
    </div>
  );
}
