import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type PageHeaderProps = ComponentProps<'header'> & {
  /** 页面主标题。 */
  heading: string;
  /** 仅在需要解释业务概念时提供的一句说明。 */
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

/** 管理页统一标题区：标题负责识别，说明负责消除歧义。 */
export function PageHeader({ heading, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <header className={cn('mb-7 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between', className)} {...props}>
      <div className="min-w-0">
        <h1 className="text-[clamp(1.65rem,3vw,2.1rem)] font-semibold leading-tight tracking-[-0.04em]">{heading}</h1>
        {description && <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
