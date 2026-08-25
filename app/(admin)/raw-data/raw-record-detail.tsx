'use client';

import { Download } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requestJson } from '@/lib/client/request';
import type { RawCaptureRecord } from '@/lib/raw-capture/types';

type PreviewPart = 'request' | 'response';
type Preview = { text: string; totalBytes: number; servedBytes: number; truncated: boolean };

export interface RawRecordDetailProps {
  record: RawCaptureRecord | null;
  returnFocusRef: RefObject<HTMLElement | null>;
  onRecordChange: (record: RawCaptureRecord | null) => void;
  onError: (message: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

async function loadPreview(recordId: string, part: PreviewPart, signal: AbortSignal): Promise<Preview> {
  const response = await fetch(`/api/admin/raw-data/records/${recordId}/${part}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === 'string' ? body.error : `正文预览加载失败（HTTP ${response.status}）`);
  }
  const text = await response.text();
  const servedBytes = new TextEncoder().encode(text).byteLength;
  const totalHeader = Number(response.headers.get('X-Raw-Total-Bytes'));
  return {
    text,
    servedBytes,
    totalBytes: Number.isFinite(totalHeader) ? totalHeader : servedBytes,
    truncated: response.headers.get('X-Raw-Truncated') === 'true',
  };
}

function PreviewPanel({ record, part, preview }: { record: RawCaptureRecord; part: PreviewPart; preview: Preview | null }) {
  const label = part === 'request' ? '请求' : '响应';
  const href = `/api/admin/raw-data/records/${record.id}/${part}?download=1`;
  return (
    <section aria-label={`${label}原始正文`} className="min-w-0">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {preview?.truncated
            ? `仅预览前 ${formatBytes(preview.servedBytes)}，完整正文 ${formatBytes(preview.totalBytes)}`
            : `完整预览 · ${formatBytes(preview?.totalBytes ?? 0)}`}
        </div>
        <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-9">
          <a href={href} download><Download className="size-4" aria-hidden="true" />下载完整{label}</a>
        </Button>
      </div>
      {!preview ? <Skeleton className="h-72 w-full" /> : (
        <div className="minimal-scrollbar max-w-full overflow-auto rounded-md border border-border bg-background">
          {preview.text.length === 0 && <p className="px-4 py-3 text-xs text-muted-foreground">正文为空</p>}
          <pre className="min-h-72 whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5 text-foreground">{preview.text}</pre>
        </div>
      )}
    </section>
  );
}

export function RawRecordDetail({ record, returnFocusRef, onRecordChange, onError }: RawRecordDetailProps) {
  const [previews, setPreviews] = useState<Record<PreviewPart, Preview | null>>({ request: null, response: null });
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (!record) return;
    const controller = new AbortController();
    const recordId = record.id;
    setPreviews({ request: null, response: null });
    setPreviewError('');
    void Promise.all([
      requestJson<{ record: RawCaptureRecord }>(`/api/admin/raw-data/records/${recordId}`, { signal: controller.signal }),
      loadPreview(recordId, 'request', controller.signal),
      loadPreview(recordId, 'response', controller.signal),
    ]).then(([detail, request, response]) => {
      if (controller.signal.aborted) return;
      onRecordChange(detail.record);
      setPreviews({ request, response });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : '原始正文加载失败';
      setPreviewError(message);
      onError(message);
    });
    return () => controller.abort();
  }, [record?.id, onError, onRecordChange]);

  return (
    <Sheet open={record !== null} onOpenChange={(open) => { if (!open) onRecordChange(null); }}>
      <SheetContent
        side="right"
        className="w-screen max-w-full sm:w-[min(94vw,52rem)] sm:max-w-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>原始记录详情</SheetTitle>
          <SheetDescription>
            {record ? `${record.entryProtocol} · ${record.path} · ${record.id}` : '查看原始请求与响应'}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="min-w-0">
          {previewError && <div role="alert" className="mb-4 rounded-md border border-destructive/25 bg-destructive-soft px-3 py-3 text-sm text-destructive">{previewError}</div>}
          {record && (
            <Tabs defaultValue="request" key={record.id}>
              <TabsList aria-label="原始正文类型" className="h-[52px] w-full md:h-10 md:w-auto">
                <TabsTrigger value="request" className="h-11 flex-1 md:h-8 md:flex-none">Request</TabsTrigger>
                <TabsTrigger value="response" className="h-11 flex-1 md:h-8 md:flex-none">Response</TabsTrigger>
              </TabsList>
              <TabsContent value="request"><PreviewPanel record={record} part="request" preview={previews.request} /></TabsContent>
              <TabsContent value="response"><PreviewPanel record={record} part="response" preview={previews.response} /></TabsContent>
            </Tabs>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
