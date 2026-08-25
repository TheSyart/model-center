import { Archive, Download, RefreshCw, Trash2 } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RawCaptureArchive } from '@/lib/raw-capture/types';

export interface ArchiveListProps {
  archives: RawCaptureArchive[];
  loading: boolean;
  pendingDay: string | null;
  archiveRunning: boolean;
  mutationPending: boolean;
  onRun: () => void;
  onDelete: (archive: RawCaptureArchive) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

const timestampFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function ArchiveList({ archives, loading, pendingDay, archiveRunning, mutationPending, onRun, onDelete }: ArchiveListProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border py-4">
        <div>
          <CardTitle>每日归档</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">每个已结束的本地自然日最多生成一个 tar.gz。</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-11 sm:min-h-9" disabled={loading || mutationPending || archiveRunning} onClick={onRun}>
          <RefreshCw className={archiveRunning ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />执行归档检查
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-5 text-sm text-muted-foreground" role="status">归档加载中</div>
        ) : archives.length === 0 ? (
          <EmptyState title="尚无每日归档" description="归档检查只会处理今天之前且已经完成的记录。" />
        ) : (
          <ul className="divide-y divide-border" aria-label="每日归档列表">
            {archives.map((item) => (
              <li key={item.day} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true"><Archive className="size-4" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <time dateTime={item.day} className="font-mono text-sm font-medium">{item.day}</time>
                      <Badge variant={item.status === 'ready' ? 'success' : 'destructive'}>{item.status === 'ready' ? '可用' : '失败'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.recordCount} 条 · 原始 {formatBytes(item.rawBytes)} · 压缩 {formatBytes(item.archiveBytes)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <time dateTime={new Date(item.createdAt).toISOString()}>
                        {item.status === 'ready' ? '压缩于' : '尝试于'} {timestampFormatter.format(item.createdAt)}
                      </time>
                    </p>
                    {item.error && <p className="mt-1 break-words text-xs text-destructive">{item.error}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {item.status === 'ready' && (
                    <Button asChild variant="outline" size="sm" className="min-h-11 flex-1 sm:min-h-9 sm:flex-none">
                      <a href={`/api/admin/raw-data/archives/${item.day}`} download aria-label={`下载 ${item.day} 归档`}><Download className="size-4" aria-hidden="true" />下载</a>
                    </Button>
                  )}
                  <Button type="button" variant="dangerOutline" size="sm" className="min-h-11 flex-1 sm:min-h-9 sm:flex-none" disabled={mutationPending || pendingDay === item.day} onClick={() => onDelete(item)} aria-label={`删除 ${item.day} 归档`}>
                    <Trash2 className="size-4" aria-hidden="true" />删除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
