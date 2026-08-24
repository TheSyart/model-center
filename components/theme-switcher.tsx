'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

const OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '系统' },
];

function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export default function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    const saved = localStorage.getItem('model-center-theme');
    const initial: ThemeMode = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    setMode(initial);
    applyTheme(initial);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if ((localStorage.getItem('model-center-theme') ?? 'system') === 'system') applyTheme('system');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  function choose(next: ThemeMode) {
    localStorage.setItem('model-center-theme', next);
    setMode(next);
    applyTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="界面主题"
      className="ml-3 flex shrink-0 self-center rounded-md border border-border bg-surface p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={mode === option.value}
          onClick={() => choose(option.value)}
          className="min-h-8 rounded px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground aria-checked:bg-foreground aria-checked:text-background"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
