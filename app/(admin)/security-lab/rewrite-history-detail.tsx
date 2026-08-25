'use client';

import { CheckCircle2, ChevronDown, CircleSlash2, Clock3, TerminalSquare, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { RewriteHistoryRecord, RewriteStep } from '@/lib/security-lab/live-types';
import { cn } from '@/lib/utils';

function StepIcon({ status }: { status: RewriteStep['status'] }) {
  if (status === 'completed') return <CheckCircle2 className="size-4 text-success" aria-hidden="true" />;
  if (status === 'failed') return <XCircle className="size-4 text-destructive" aria-hidden="true" />;
  return <CircleSlash2 className="size-4 text-muted-foreground" aria-hidden="true" />;
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="minimal-scrollbar max-w-full overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-5 text-muted-foreground"><code>{JSON.stringify(value, null, 2)}</code></pre>;
}

function OutputBlock({ content, error }: { content: string; error: boolean }) {
  return (
    <pre className={cn(
      'minimal-scrollbar max-h-80 overflow-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-[11px] leading-5',
      error
        ? 'border-destructive/25 bg-destructive-soft text-destructive'
        : 'border-success/25 bg-success-soft text-foreground',
    )}>{content || '(无输出)'}</pre>
  );
}

export function RewriteHistoryDetail({ record, onOpenChange }: { record: RewriteHistoryRecord | null; onOpenChange(open: boolean): void }) {
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => setTimelineOpen(false), [record?.id]);

  const injected = record?.tools?.injected;
  const toolResult = injected?.result;

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

            {injected && (
              <section aria-labelledby="tool-result-title" className="rounded-lg border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-destructive">
                      <TerminalSquare className="size-4" aria-hidden="true" />
                      <h3 id="tool-result-title" className="text-sm font-semibold">工具执行结果</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">中转新增的 {injected.name} 调用及 Claude Code 的真实回传。</p>
                  </div>
                  {!toolResult
                    ? <Badge variant="warning">等待执行</Badge>
                    : toolResult.isError
                      ? <Badge variant="destructive">执行失败</Badge>
                      : <Badge variant="success">执行成功</Badge>}
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">注入调用</p>
                    <JsonBlock value={{ id: injected.id, name: injected.name, input: injected.input }} />
                  </div>
                  {toolResult ? (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">返回输出</p>
                        <span className="text-[11px] text-subtle-foreground">{new Date(toolResult.returnedAt).toLocaleString('zh-CN', { hour12: false })}</span>
                      </div>
                      <OutputBlock content={toolResult.content} error={toolResult.isError} />
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-warning/30 bg-warning-soft px-3 py-4 text-xs leading-5 text-warning">
                      已把工具调用返回 Claude Code，正在等待下一次请求中的 <code>tool_result</code>。
                    </div>
                  )}
                </div>
              </section>
            )}

            {record.prompt && (
              <section aria-labelledby="prompt-diff-title">
                <h3 id="prompt-diff-title" className="text-sm font-semibold">提示词前后差异</h3>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div><p className="mb-2 text-xs font-medium text-muted-foreground">原始用户文本</p><JsonBlock value={record.prompt.before} /></div>
                  <div><p className="mb-2 text-xs font-medium text-destructive">实际转发文本</p><JsonBlock value={record.prompt.after} /></div>
                </div>
              </section>
            )}

            {record.tools?.original.length ? (
              <section aria-labelledby="original-tools-title">
                <h3 id="original-tools-title" className="text-sm font-semibold">上游原始工具调用</h3>
                <div className="mt-3"><JsonBlock value={record.tools.original} /></div>
              </section>
            ) : null}

            <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen}>
              <section aria-labelledby="rewrite-timeline-title" className="border-t border-border pt-4">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between" aria-label={timelineOpen ? '收起技术时间线' : '展开技术时间线'}>
                    <span className="flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" /><span id="rewrite-timeline-title">技术时间线</span></span>
                    <ChevronDown className={cn('size-4 transition-transform', timelineOpen && 'rotate-180')} aria-hidden="true" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
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
                </CollapsibleContent>
              </section>
            </Collapsible>

            {record.error && <div role="alert" className="rounded-md border border-destructive/25 bg-destructive-soft p-3 text-sm text-destructive">{record.error}</div>}
          </SheetBody>
        )}
      </SheetContent>
    </Sheet>
  );
}
