'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoIcon } from './icons';
import ThemeSwitcher from './theme-switcher';

const NAV_ITEMS = [
  { href: '/', label: '仪表盘' },
  { href: '/providers', label: '服务商' },
  { href: '/aliases', label: '别名' },
  { href: '/prompts', label: '提示词' },
  { href: '/tokens', label: '令牌' },
  { href: '/logs', label: '日志' },
  { href: '/settings', label: '设置' },
];

/** 顶部导航（sticky + 当前页高亮）。 */
export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-stretch px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-[-0.02em] text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
            <LogoIcon className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Model Center</span>
        </Link>
        <nav aria-label="主导航" className="minimal-scrollbar ml-5 flex min-w-0 flex-1 items-stretch gap-5 overflow-x-auto sm:ml-10 sm:gap-7">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex shrink-0 items-center px-0.5 text-sm transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:bg-primary after:transition-transform ${
                  active
                    ? 'font-medium text-foreground after:scale-x-100'
                    : 'text-muted-foreground after:scale-x-0 hover:text-foreground hover:after:scale-x-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
