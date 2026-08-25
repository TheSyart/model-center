'use client';

import { Check, Laptop, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type ThemeMode = 'light' | 'dark' | 'system';
const OPTIONS = [
  { value: 'light' as const, label: '浅色', icon: Sun },
  { value: 'dark' as const, label: '深色', icon: Moon },
  { value: 'system' as const, label: '跟随系统', icon: Laptop },
];

function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>('system');
  useEffect(() => {
    const saved = localStorage.getItem('model-center-theme');
    const initial: ThemeMode = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    setMode(initial); applyTheme(initial);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if ((localStorage.getItem('model-center-theme') ?? 'system') === 'system') applyTheme('system'); };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  function choose(next: ThemeMode) { localStorage.setItem('model-center-theme', next); setMode(next); applyTheme(next); }
  const current = OPTIONS.find((option) => option.value === mode) ?? OPTIONS[2];
  const CurrentIcon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? 'icon' : 'default'} className={cn('w-full justify-start text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground', compact && 'w-10 justify-center px-0')} aria-label={`界面主题：${current.label}`}>
          <CurrentIcon className="size-4" />{!compact && <span className="flex-1 text-left">界面主题</span>}{!compact && <span className="text-xs font-normal text-sidebar-muted">{current.label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-44">
        <DropdownMenuLabel>界面主题</DropdownMenuLabel><DropdownMenuSeparator />
        {OPTIONS.map((option) => <DropdownMenuItem key={option.value} onSelect={() => choose(option.value)}><option.icon className="size-4" /><span className="flex-1">{option.label}</span>{mode === option.value && <Check className="size-4 text-primary" />}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
