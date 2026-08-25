import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

export const metadata: Metadata = {
  title: 'Model Center',
  description: '个人模型聚合平台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    (() => {
      try {
        const saved = localStorage.getItem('model-center-theme');
        const mode = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
        const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
        const root = document.documentElement;
        root.dataset.theme = dark ? 'dark' : 'light';
        root.dataset.themeMode = mode;
        root.style.colorScheme = dark ? 'dark' : 'light';
      } catch {}
    })();
  `;
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen bg-background text-foreground`}>{children}</body>
    </html>
  );
}
