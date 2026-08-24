import type { ComponentProps } from 'react';
import { cn } from './ui';

export type PageHeaderProps = ComponentProps<'header'> & {
  /** 页面主标题。 */
  heading: string;
  /** 仅在需要解释业务概念时提供的一句说明。 */
  description?: React.ReactNode;
};

/** 管理页统一标题区：标题负责识别，说明负责消除歧义。 */
export function PageHeader({ heading, description, className, ...props }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 border-b border-border pb-6', className)} {...props}>
      <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-tight tracking-[-0.035em]">{heading}</h1>
      {description && <div className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{description}</div>}
    </header>
  );
}
