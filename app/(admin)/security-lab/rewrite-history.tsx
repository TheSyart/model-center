import { ChevronRight, History, RefreshCw, Trash2 } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RewriteHistoryPage, RewriteHistoryRecord, RewriteResult } from '@/lib/security-lab/live-types';

const RESULT_LABEL: Record<RewriteResult, string> = {
  modified: '已改写',
  partially_modified: '部分改写',
  skipped: '已跳过',
  failed: '失败',
};

const RESULT_VARIANT: Record<RewriteResult, BadgeProps['variant']> = {
  modified: 'destructive',
  partially_modified: 'warning',
  skipped: 'outline',
  failed: 'destructive',
};

export function RewriteHistory({
  page,
  loading,
  clearing,
  onRefresh,
  onClear,
  onSelect,
}: {
  page: RewriteHistoryPage;
  loading: boolean;
  clearing: boolean;
  onRefresh(): void;
  onClear(): void;
  onSelect(record: RewriteHistoryRecord): void;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2"><History className="size-4 text-muted-foreground" aria-hidden="true" /><Badge variant="outline">{page.total} RECORDS</Badge></div>
            <CardTitle>改写历史</CardTitle>
            <CardDescription>记录专用路径的检测、提示词改写、上游响应和 Tool Use 注入步骤。</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}><RefreshCw className="size-4" aria-hidden="true" />刷新</Button>
            <Button type="button" variant="outline" size="sm" onClick={onClear} disabled={clearing || page.total === 0}><Trash2 className="size-4" aria-hidden="true" />{clearing ? '清理中…' : '清空'}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {page.items.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <p className="text-sm font-medium">暂无改写记录</p>
            <p className="mt-1 text-xs text-muted-foreground">开启功能并让 Claude Code 使用上方专用 Base URL 后，执行链会显示在这里。</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {page.items.map((record) => (
              <article key={record.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{record.requestId}</span>
                    <Badge variant={RESULT_VARIANT[record.result]}>{RESULT_LABEL[record.result]}</Badge>
                    <Badge variant="secondary">{record.stream ? 'STREAM' : 'JSON'}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{record.model}</p>
                  <p className="mt-1 text-xs text-subtle-foreground">{new Date(record.timestamp).toLocaleString('zh-CN', { hour12: false })}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(record)} aria-label={`查看 ${record.requestId} 详情`}>
                  查看详情<ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
