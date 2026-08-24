import { redirect } from 'next/navigation';

// 模型管理已并入服务商页（卡片展开区），旧路径重定向避免书签 404
export default function ModelsPage() {
  redirect('/providers');
}
