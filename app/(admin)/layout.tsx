import Nav from '@/components/nav';
import { ConfirmProvider } from '@/components/confirm-dialog';
import { ToastProvider } from '@/components/toast';

// 管理后台无认证：仅限本机/受信网络使用（§10）
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="min-h-screen">
          <Nav />
          <main className="page-enter mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">{children}</main>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
