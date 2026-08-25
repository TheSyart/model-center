import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RawCapturePage, RawCaptureRecord } from '@/lib/raw-capture/types';

export interface RawRecordListProps {
  page: RawCapturePage;
  loading: boolean;
  refreshing: boolean;
  mutationPending: boolean;
  onRefresh: () => void;
  onSelect: (record: RawCaptureRecord) => void;
  onPageChange: (page: number) => void;
}

const protocolLabels: Record<RawCaptureRecord['entryProtocol'], string> = {
  anthropic: 'Messages',
  openai: 'Chat',
  responses: 'Responses',
  'security-lab-anthropic': 'Security Lab',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(timestamp);
}

function CompletionBadge({ record }: { record: RawCaptureRecord }) {
  return record.complete
    ? <Badge variant="success">完整</Badge>
    : <Badge variant="warning">不完整</Badge>;
}

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return <Badge variant="secondary">处理中</Badge>;
  if (status >= 500) return <Badge variant="destructive">{status}</Badge>;
  if (status >= 400) return <Badge variant="warning">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function RecordAction({ record, onSelect }: { record: RawCaptureRecord; onSelect: (record: RawCaptureRecord) => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => onSelect(record)} aria-label={`查看记录 ${record.id}`}>
      查看
    </Button>
  );
}

export function RawRecordList({ page, loading, refreshing, mutationPending, onRefresh, onSelect, onPageChange }: RawRecordListProps) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border py-4">
        <div>
          <CardTitle>原始记录</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">仅展示索引元数据，不读取或分析正文。</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={onRefresh} disabled={refreshing || mutationPending}>
          <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />刷新数据
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <SkeletonRows rows={5} /> : page.items.length === 0 ? (
          <EmptyState title="尚无原始记录" description="手动开启采集后，新进入网关的模型请求会显示在这里。" />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>协议 / 路径</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>传输</TableHead>
                    <TableHead>请求 / 响应</TableHead>
                    <TableHead>完整性</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.items.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{formatTime(record.startedAt)}</TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">{protocolLabels[record.entryProtocol]}</div>
                        <code className="mt-0.5 block max-w-[18rem] truncate font-mono text-xs text-muted-foreground" title={record.path}>{record.path}</code>
                      </TableCell>
                      <TableCell><StatusBadge status={record.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{record.stream ? '流式' : '非流式'}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{formatBytes(record.requestBytes)} / {formatBytes(record.responseBytes)}</TableCell>
                      <TableCell><CompletionBadge record={record} /></TableCell>
                      <TableCell className="text-right"><RecordAction record={record} onSelect={onSelect} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden" aria-label="原始记录列表">
              {page.items.map((record) => (
                <li key={record.id} className="space-y-3 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{protocolLabels[record.entryProtocol]}</span>
                        <StatusBadge status={record.status} />
                        <CompletionBadge record={record} />
                      </div>
                      <code className="mt-1 block break-all font-mono text-xs text-muted-foreground">{record.path}</code>
                    </div>
                    <RecordAction record={record} onSelect={onSelect} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div><dt className="text-muted-foreground">时间</dt><dd className="mt-0.5 font-mono">{formatTime(record.startedAt)}</dd></div>
                    <div><dt className="text-muted-foreground">传输</dt><dd className="mt-0.5">{record.stream ? '流式' : '非流式'}</dd></div>
                    <div><dt className="text-muted-foreground">请求</dt><dd className="mt-0.5 font-mono">{formatBytes(record.requestBytes)}</dd></div>
                    <div><dt className="text-muted-foreground">响应</dt><dd className="mt-0.5 font-mono">{formatBytes(record.responseBytes)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
      {!loading && page.total > 0 && (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>第 {page.page} / {totalPages} 页，共 {page.total} 条</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="min-h-11 sm:min-h-9" disabled={page.page <= 1 || refreshing || mutationPending} onClick={() => onPageChange(page.page - 1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />上一页
            </Button>
            <Button type="button" variant="outline" size="sm" className="min-h-11 sm:min-h-9" disabled={page.page >= totalPages || refreshing || mutationPending} onClick={() => onPageChange(page.page + 1)}>
              下一页<ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
