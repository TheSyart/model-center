import { btn } from './ui';

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
      <div className="mb-4 h-px w-10 bg-border" aria-hidden="true" />
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      {description && <div className="mt-1.5 max-w-md text-xs leading-5 text-subtle-foreground">{description}</div>}
      {actionLabel && onAction && (
        <button onClick={onAction} className={`mt-5 ${btn.primary}`}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** 列表加载骨架屏。 */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5" aria-label="加载中">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-sm bg-muted" />
          <div className="h-3.5 flex-1 rounded-sm bg-muted" />
          <div className="h-3.5 w-24 rounded-sm bg-muted" />
        </div>
      ))}
    </div>
  );
}
