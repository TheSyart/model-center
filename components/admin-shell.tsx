'use client';

import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Nav from '@/components/nav';
import ThemeSwitcher from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const SIDEBAR_KEY = 'model-center-sidebar-collapsed';

export function AdminShell({ children, contentClassName }: { children: React.ReactNode; contentClassName?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setCollapsed(localStorage.getItem(SIDEBAR_KEY) === 'true'); }, []);
  function toggleCollapsed() {
    setCollapsed((current) => { const next = !current; localStorage.setItem(SIDEBAR_KEY, String(next)); return next; });
  }
  return (
    <TooltipProvider delayDuration={250}>
    <div className="min-h-screen bg-background">
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex lg:flex-col', collapsed ? 'w-16' : 'w-60')}>
        <Nav collapsed={collapsed} />
        <Button variant="outline" size="iconSm" onClick={toggleCollapsed} aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'} className="absolute -right-[18px] top-[72px] z-10 size-9 rounded-full bg-surface shadow-sm">{collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}</Button>
      </aside>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-border bg-background/95 px-3 backdrop-blur-md lg:hidden">
        <Button variant="ghost" size="icon" aria-label="打开导航" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></Button>
        <Link href="/" className="ml-1 flex min-w-0 items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-md border border-border bg-brand-surface"><Image src="/brand/model-center-mark.png" alt="" width={28} height={28} className="size-7 object-contain" /></span><span className="truncate text-sm font-semibold">Model Center</span></Link>
        <div className="ml-auto"><ThemeSwitcher compact /></div>
      </header>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[86vw] p-0"><SheetTitle className="sr-only">Model Center 导航</SheetTitle><Nav onNavigate={() => setMobileOpen(false)} showTheme={false} /></SheetContent>
      </Sheet>
      <div className={cn('transition-[padding] duration-200 lg:pl-60', collapsed && 'lg:pl-16')}>
        <main className={cn('page-enter mx-auto max-w-[1440px] px-4 pt-20 sm:px-6 lg:px-8 lg:pt-10', contentClassName)}>{children}</main>
      </div>
    </div>
    </TooltipProvider>
  );
}
