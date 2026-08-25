import { Inbox } from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

/** 统一空状态：图标 + 说明 + 可选引导按钮。 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground" aria-hidden="true"><Inbox className="size-4" /></div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description && <div className="mt-1.5 max-w-md text-xs leading-5 text-subtle-foreground">{description}</div>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5">{actionLabel}</Button>
      )}
    </div>
  );
}

/** 列表加载骨架屏。 */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" aria-label="加载中">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-7" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      ))}
    </div>
  );
}
