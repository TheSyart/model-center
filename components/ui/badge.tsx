import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary-soft text-primary',
      secondary: 'border-border bg-muted text-muted-foreground',
      success: 'border-success/20 bg-success-soft text-success',
      warning: 'border-warning/20 bg-warning-soft text-warning',
      destructive: 'border-destructive/20 bg-destructive-soft text-destructive',
      outline: 'border-border bg-surface text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
