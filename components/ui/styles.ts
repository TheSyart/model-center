import { buttonVariants } from './button';

/** Shared layout classes for dense domain tables and legacy-compatible forms. */
export const btn = {
  primary: buttonVariants({ variant: 'default' }),
  ghost: buttonVariants({ variant: 'outline' }),
  danger: buttonVariants({ variant: 'dangerOutline' }),
  link: buttonVariants({ variant: 'link' }),
  linkDanger: `${buttonVariants({ variant: 'link' })} text-destructive hover:text-destructive`,
} as const;

export const inputCls =
  'h-11 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-subtle-foreground hover:border-foreground/20 focus:border-primary/60 focus:ring-2 focus:ring-ring/20 disabled:bg-muted disabled:opacity-60 sm:h-9';

export const cardCls = 'rounded-lg border border-border bg-surface';
export const tableWrapCls = `minimal-scrollbar overflow-x-auto ${cardCls}`;
export const tableHeadCls = 'border-b border-border bg-muted/70 text-left text-xs text-muted-foreground';
