'use client';

import {
  AlertTriangle,
  ChevronRight,
  History,
  MessageSquareWarning,
  RefreshCw,
  TerminalSquare,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RewriteHistoryPage, RewriteHistoryRecord, RewriteResult } from '@/lib/security-lab/live-types';
import { cn } from '@/lib/utils';

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

type HistoryFilter = 'all' | 'prompt' | 'tool' | 'failed';

const FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'prompt', label: '提示词' },
  { id: 'tool', label: '工具' },
  { id: 'failed', label: '失败' },
];

function matchesFilter(record: RewriteHistoryRecord, filter: HistoryFilter): boolean {
  if (filter === 'prompt') return Boolean(record.prompt);
  if (filter === 'tool') return Boolean(record.tools?.injected);
  if (filter === 'failed') return record.result === 'failed' || record.tools?.injected?.result?.isError === true;
  return true;
}

function ToolResultBadge({ record }: { record: RewriteHistoryRecord }) {
  const injected = record.tools?.injected;
  if (!injected) return null;
  if (!injected.result) return <Badge variant="warning">等待结果</Badge>;
  return injected.result.isError
    ? <Badge variant="destructive">执行失败</Badge>
    : <Badge variant="success">执行成功</Badge>;
}

function toolCommand(record: RewriteHistoryRecord): string {
  const input = record.tools?.injected?.input;
  if (typeof input?.command === 'string') return input.command;
  return JSON.stringify(input ?? {});
}

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
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const items = useMemo(
    () => page.items.filter((record) => matchesFilter(record, filter)),
    [filter, page.items],
  );

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <History className="size-4 text-muted-foreground" aria-hidden="true" />
              <Badge variant="outline">{items.length} / {page.total} 条</Badge>
            </div>
            <CardTitle>改写历史</CardTitle>
            <CardDescription>直接查看提示词变化、注入工具及 Claude Code 返回的真实执行结果。</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className="size-4" aria-hidden="true" />刷新
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClear} disabled={clearing || page.total === 0}>
              <Trash2 className="size-4" aria-hidden="true" />{clearing ? '清理中…' : '清空'}
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1" aria-label="历史类型筛选">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filter === item.id ? 'secondary' : 'ghost'}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <p className="text-sm font-medium">{page.total === 0 ? '暂无改写记录' : '当前筛选没有记录'}</p>
            <p className="mt-1 text-xs text-muted-foreground">开启功能并让 Claude Code 使用专用 Base URL 后，执行链会显示在这里。</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((record) => {
              const significant = Boolean(record.prompt || record.tools?.injected || record.result === 'failed');
              const toolResult = record.tools?.injected?.result;
              return (
                <article
                  key={record.id}
                  className={cn(
                    'grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5',
                    !significant && 'bg-muted/20 text-muted-foreground',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold">{record.requestId}</span>
                      <Badge variant={RESULT_VARIANT[record.result]}>{RESULT_LABEL[record.result]}</Badge>
                      {record.prompt && <Badge variant="warning"><MessageSquareWarning className="size-3" aria-hidden="true" />提示词</Badge>}
                      {record.tools?.injected && <Badge variant="destructive"><TerminalSquare className="size-3" aria-hidden="true" />{record.tools.injected.name}</Badge>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle-foreground">
                      <span>{record.model}</span>
                      <span>{new Date(record.timestamp).toLocaleString('zh-CN', { hour12: false })}</span>
                      <span>{record.stream ? 'STREAM' : 'JSON'}</span>
                    </div>

                    {record.prompt && (
                      <div className="mt-3 rounded-md border border-warning/20 bg-warning-soft/40 px-3 py-2">
                        <p className="text-[11px] font-medium text-warning">原始用户内容</p>
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-foreground">{record.prompt.before}</p>
                      </div>
                    )}

                    {record.tools?.injected && (
                      <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
                        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                          <span className="text-[11px] font-medium text-muted-foreground">注入的 {record.tools.injected.name}</span>
                          <ToolResultBadge record={record} />
                        </div>
                        <code className="block truncate px-3 py-2 font-mono text-[11px] text-foreground">{toolCommand(record)}</code>
                        {toolResult && (
                          <pre className={cn(
                            'max-h-20 overflow-hidden whitespace-pre-wrap border-t border-border px-3 py-2 font-mono text-[11px] leading-5',
                            toolResult.isError ? 'bg-destructive-soft text-destructive' : 'bg-success-soft text-foreground',
                          )}>{toolResult.content || '(无输出)'}</pre>
                        )}
                      </div>
                    )}

                    {!significant && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />本次续传没有产生新的改写
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start sm:self-center"
                    onClick={() => onSelect(record)}
                    aria-label={`查看 ${record.requestId} 详情`}
                  >
                    查看详情<ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
