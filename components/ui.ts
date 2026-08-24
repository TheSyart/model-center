/** 合并条件 className；项目不引入额外样式依赖。 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** 统一视觉语言：按钮、输入、表面、表格与开关样式常量。 */

export const btn = {
  primary:
    'inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-[background-color,transform] duration-200 hover:bg-primary-hover active:translate-y-px disabled:pointer-events-none disabled:opacity-45',
  ghost:
    'inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:border-foreground/20 hover:text-foreground disabled:pointer-events-none disabled:opacity-45',
  danger:
    'inline-flex min-h-10 items-center justify-center rounded-md border border-destructive/25 bg-surface px-3 py-2 text-sm font-medium text-destructive transition-colors duration-200 hover:bg-destructive-soft disabled:pointer-events-none disabled:opacity-45',
  /** 行内文字按钮 */
  link: 'inline-flex min-h-8 items-center text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary-hover hover:underline',
  linkDanger:
    'inline-flex min-h-8 items-center text-sm font-medium text-destructive underline-offset-4 transition-colors hover:underline',
} as const;

export const inputCls =
  'min-h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors placeholder:text-subtle-foreground hover:border-foreground/20 focus:border-foreground/35 disabled:bg-muted disabled:text-subtle-foreground';

export const cardCls = 'rounded-lg border border-border bg-surface';
export const tableWrapCls = `minimal-scrollbar overflow-x-auto ${cardCls}`;
export const tableHeadCls = 'border-b border-border bg-muted/65 text-left text-xs text-muted-foreground';
export const sectionTitleCls = 'text-sm font-semibold tracking-[0.04em] text-foreground';

/** 大启停开关（w-11/h-6，圆点 20px，位移 22px） */
export function toggleCls(enabled: boolean): string {
  return `relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors ${enabled ? 'bg-success' : 'bg-border'}`;
}
export function toggleKnobCls(enabled: boolean): string {
  return `absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0'}`;
}

/** 小启停开关（w-9/h-5，圆点 16px，位移 18px） */
export function toggleSmCls(enabled: boolean): string {
  return `relative h-5 w-9 shrink-0 overflow-hidden rounded-full transition-colors ${enabled ? 'bg-success' : 'bg-border'}`;
}
export function toggleSmKnobCls(enabled: boolean): string {
  return `absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-0'}`;
}
