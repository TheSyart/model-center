import { AdminShell } from '@/components/admin-shell';
import { ConfirmProvider } from '@/components/confirm-dialog';
import { ToastProvider } from '@/components/toast';

// 管理后台无认证：仅限本机/受信网络使用（§10）
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AdminShell contentClassName="admin-page-content">{children}</AdminShell>
      </ConfirmProvider>
    </ToastProvider>
  );
}
