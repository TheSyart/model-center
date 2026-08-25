import { CheckCircle2, CircleSlash2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { RewriteHistoryRecord, RewriteStep } from '@/lib/security-lab/live-types';

function StepIcon({ status }: { status: RewriteStep['status'] }) {
  if (status === 'completed') return <CheckCircle2 className="size-4 text-success" aria-hidden="true" />;
  if (status === 'failed') return <XCircle className="size-4 text-destructive" aria-hidden="true" />;
  return <CircleSlash2 className="size-4 text-muted-foreground" aria-hidden="true" />;
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="minimal-scrollbar max-w-full overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-5 text-muted-foreground"><code>{JSON.stringify(value, null, 2)}</code></pre>;
}

export function RewriteHistoryDetail({ record, onOpenChange }: { record: RewriteHistoryRecord | null; onOpenChange(open: boolean): void }) {
  return (
    <Sheet open={record !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(96vw,48rem)] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>改写详情</SheetTitle>
          <SheetDescription>{record ? `${record.requestId} · ${record.model}` : '查看改写执行链'}</SheetDescription>
        </SheetHeader>
        {record && (
          <SheetBody className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{record.stream ? 'STREAM' : 'JSON'}</Badge>
              <Badge variant={record.result === 'modified' ? 'destructive' : record.result === 'partially_modified' ? 'warning' : 'outline'}>{record.result}</Badge>
              <Badge variant="secondary">{record.source}</Badge>
            </div>

            <section aria-labelledby="rewrite-timeline-title">
              <h3 id="rewrite-timeline-title" className="text-sm font-semibold">执行时间线</h3>
              <ol className="mt-3 space-y-2">
                {record.steps.map((step, index) => (
                  <li key={`${step.code}-${index}`} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 rounded-md border border-border bg-background p-3">
                    <StepIcon status={step.status} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><code className="text-xs font-semibold">{step.code}</code><Badge variant="outline">{step.status}</Badge></div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {record.prompt && (
              <section aria-labelledby="prompt-diff-title">
                <h3 id="prompt-diff-title" className="text-sm font-semibold">提示词前后差异</h3>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div><p className="mb-2 text-xs font-medium text-muted-foreground">原始用户文本</p><JsonBlock value={record.prompt.before} /></div>
                  <div><p className="mb-2 text-xs font-medium text-destructive">实际转发文本</p><JsonBlock value={record.prompt.after} /></div>
                </div>
              </section>
            )}

            {record.tools && (
              <section aria-labelledby="tool-diff-title">
                <h3 id="tool-diff-title" className="text-sm font-semibold">工具调用</h3>
                <div className="mt-3 space-y-3">
                  <div><p className="mb-2 text-xs font-medium text-muted-foreground">上游原始调用</p><JsonBlock value={record.tools.original} /></div>
                  {record.tools.injected && <div><p className="mb-2 text-xs font-medium text-destructive">中转新增调用</p><JsonBlock value={record.tools.injected} /></div>}
                </div>
              </section>
            )}

            {record.error && <div role="alert" className="rounded-md border border-destructive/25 bg-destructive-soft p-3 text-sm text-destructive">{record.error}</div>}
          </SheetBody>
        )}
      </SheetContent>
    </Sheet>
  );
}
