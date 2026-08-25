import { DatabaseBackup, HardDrive, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import type { RawCaptureConfig, RawCaptureStatus } from '@/lib/raw-capture/types';

export interface CaptureControlProps {
  config: RawCaptureConfig | null;
  status: RawCaptureStatus | null;
  pending: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

const numberFormatter = new Intl.NumberFormat('zh-CN');

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
}

function formatDateTime(value: number | null): string {
  if (value === null) return '尚无数据';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(value);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background px-3 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-mono text-sm font-medium text-foreground" title={value}>{value}</dd>
    </div>
  );
}

export function CaptureControl({ config, status, pending, onEnabledChange }: CaptureControlProps) {
  const loading = !config || !status;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                <HardDrive className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">完整对话采集</CardTitle>
                  {loading ? <Skeleton className="h-5 w-14" /> : <Badge variant={config.enabled ? 'destructive' : 'outline'}>{config.enabled ? '采集中' : '已关闭'}</Badge>}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">开启后，新进入网关的请求与最终响应会按原始字节写入本机。</p>
              </div>
            </div>
            <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 sm:min-h-9 sm:justify-end">
              <label htmlFor="raw-capture-enabled" className="text-sm font-medium">记录所有原始对话</label>
              <Switch
                id="raw-capture-enabled"
                checked={config?.enabled ?? false}
                disabled={loading || pending}
                onCheckedChange={onEnabledChange}
                aria-describedby="raw-capture-help"
              />
            </div>
          </div>
          <p id="raw-capture-help" className="sr-only">默认关闭。开启前需要确认，关闭不会删除历史数据。</p>
        </CardHeader>
        <CardContent className="pt-5">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="采集状态加载中">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[70px]" />)}
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric label="今日原始数据" value={`${numberFormatter.format(status.todayRecords)} 条`} />
                <Metric label="今日原始大小" value={formatBytes(status.todayBytes)} />
                <Metric label="全部记录" value={`${numberFormatter.format(status.totalRecords)} 条`} />
                <Metric label="全部原始大小" value={formatBytes(status.totalBytes)} />
                <Metric label="每日归档" value={`${numberFormatter.format(status.archiveCount)} 个`} />
                <Metric label="覆盖开始" value={formatDateTime(status.coverageStart)} />
                <Metric label="覆盖结束" value={formatDateTime(status.coverageEnd)} />
                <Metric label="最近归档" value={status.lastArchive?.day ?? '尚无归档'} />
              </dl>
              <div className="mt-4 rounded-md border border-border bg-muted/45 px-3 py-3">
                <div className="text-xs font-medium text-muted-foreground">本地保存目录</div>
                <code className="mt-1 block break-all font-mono text-xs text-foreground">{status.rootDir}</code>
              </div>
              {status.lastCaptureError && (
                <div className="mt-3 rounded-md border border-destructive/25 bg-destructive-soft px-3 py-3 text-sm text-destructive">
                  最近采集错误：{status.lastCaptureError}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/25">
        <CardContent className="flex h-full flex-col p-5 sm:p-6">
          <span className="flex size-10 items-center justify-center rounded-md bg-destructive-soft text-destructive" aria-hidden="true">
            <ShieldAlert className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold tracking-[-0.02em]">中转站的数据包视角</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            完整留存可能包含提示词、模型回答、代码上下文和工具结果。这正是中转站能够整理并贩卖用户数据的风险。
          </p>
          <div className="mt-auto flex items-center gap-2 pt-5 text-xs font-medium text-success">
            <DatabaseBackup className="size-4" aria-hidden="true" />
            本模块的数据始终只保存在本机
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
