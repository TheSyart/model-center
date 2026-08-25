'use client';

import type { LucideIcon } from 'lucide-react';
import { Activity, Gauge, KeyRound, Link2, MessageSquareText, Server, Settings, ShieldAlert } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import ThemeSwitcher from './theme-switcher';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: '概览', items: [{ href: '/', label: '仪表盘', icon: Gauge }] },
  { label: '网关管理', items: [
    { href: '/providers', label: '服务商', icon: Server },
    { href: '/aliases', label: '别名', icon: Link2 },
    { href: '/prompts', label: '提示词', icon: MessageSquareText },
    { href: '/tokens', label: '令牌', icon: KeyRound },
  ] },
  { label: '可观测性', items: [{ href: '/logs', label: '日志', icon: Activity }] },
  { label: '安全', items: [{ href: '/security-lab', label: '中转风险', icon: ShieldAlert }] },
  { label: '系统', items: [{ href: '/settings', label: '设置', icon: Settings }] },
];

export interface NavProps { collapsed?: boolean; onNavigate?: () => void; showTheme?: boolean }

export default function Nav({ collapsed = false, onNavigate, showTheme = true }: NavProps) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Link href="/" onClick={onNavigate} aria-label="Model Center 首页" className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4', collapsed && 'justify-center px-2')}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-brand-surface shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <Image src="/brand/model-center-mark.png" alt="" width={32} height={32} priority className="size-7 select-none object-contain" draggable={false} />
        </span>
        {!collapsed && <span className="truncate text-sm font-semibold tracking-[-0.02em] text-sidebar-foreground">Model Center</span>}
      </Link>
      <nav aria-label="主导航" className="minimal-scrollbar flex-1 overflow-y-auto px-2 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {!collapsed && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">{group.label}</div>}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const link = (
                  <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} aria-label={collapsed ? item.label : undefined} className={cn('group flex h-10 items-center gap-3 rounded-md px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', active ? 'bg-sidebar-active text-sidebar-foreground shadow-[inset_0_0_0_1px_var(--sidebar-border)]' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground', collapsed && 'justify-center px-0')}>
                    <item.icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-sidebar-muted group-hover:text-sidebar-foreground')} strokeWidth={1.8} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
                return collapsed ? <Tooltip key={item.href}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{item.label}</TooltipContent></Tooltip> : link;
              })}
            </div>
          </div>
        ))}
      </nav>
      {showTheme && <div className={cn('border-t border-sidebar-border p-2', collapsed && 'flex justify-center')}><ThemeSwitcher compact={collapsed} /></div>}
    </div>
  );
}
