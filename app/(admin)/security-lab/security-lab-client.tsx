'use client';

import { Copy, RadioTower, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConfirm } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requestJson } from '@/lib/client/request';
import { DEFAULT_SECURITY_LAB_CONFIG } from '@/lib/security-lab/config';
import type { RewriteHistoryPage, RewriteHistoryRecord, SecurityLabConfig } from '@/lib/security-lab/live-types';
import { PromptRewriteCard, ToolRewriteCard } from './rewrite-config-card';
import { RewriteHistory } from './rewrite-history';
import { RewriteHistoryDetail } from './rewrite-history-detail';

type ConfigResponse = { config: SecurityLabConfig };

export default function SecurityLabClient({ initialBaseUrl }: { initialBaseUrl?: string }) {
  const [config, setConfig] = useState<SecurityLabConfig | null>(null);
  const [draft, setDraft] = useState<SecurityLabConfig>(structuredClone(DEFAULT_SECURITY_LAB_CONFIG));
  const [toolInputText, setToolInputText] = useState(JSON.stringify(DEFAULT_SECURITY_LAB_CONFIG.toolInjection.toolInput, null, 2));
  const [history, setHistory] = useState<RewriteHistoryPage>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [selected, setSelected] = useState<RewriteHistoryRecord | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const { confirm } = useConfirm();

  const baseUrl = useMemo(() => {
    if (initialBaseUrl) return initialBaseUrl;
    if (typeof window === 'undefined') return '/security-lab';
    return `${window.location.origin}/security-lab`;
  }, [initialBaseUrl]);

  const loadHistory = useCallback(async () => {
    try {
      const page = await requestJson<RewriteHistoryPage>('/api/admin/security-lab/history?page=1&page_size=20');
      setHistory(page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '历史记录加载失败');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      requestJson<ConfigResponse>('/api/admin/security-lab/config'),
      requestJson<RewriteHistoryPage>('/api/admin/security-lab/history?page=1&page_size=20'),
    ]).then(([configResponse, historyResponse]) => {
      if (cancelled) return;
      setConfig(configResponse.config);
      setDraft(structuredClone(configResponse.config));
      setToolInputText(JSON.stringify(configResponse.config.toolInjection.toolInput, null, 2));
      setHistory(historyResponse);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Security Lab 加载失败');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!config?.promptInjection.enabled && !config?.toolInjection.enabled) return;
    const timer = window.setInterval(() => { void loadHistory(); }, 1500);
    return () => window.clearInterval(timer);
  }, [config?.promptInjection.enabled, config?.toolInjection.enabled, loadHistory]);

  async function persist(next: SecurityLabConfig, successMessage: string) {
    setPending(successMessage);
    setNotice('');
    setError('');
    try {
      const response = await requestJson<ConfigResponse>('/api/admin/security-lab/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      setConfig(response.config);
      setDraft(structuredClone(response.config));
      setToolInputText(JSON.stringify(response.config.toolInjection.toolInput, null, 2));
      setNotice(successMessage);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '配置保存失败');
    } finally {
      setPending(null);
    }
  }

  async function savePrompt() {
    await persist(draft, '提示词注入配置已保存');
  }

  async function saveTool() {
    setError('');
    let toolInput: unknown;
    try {
      toolInput = JSON.parse(toolInputText);
    } catch {
      setError('请输入合法的 JSON 对象');
      return;
    }
    if (!toolInput || typeof toolInput !== 'object' || Array.isArray(toolInput)) {
      setError('请输入合法的 JSON 对象');
      return;
    }
    await persist({
      ...draft,
      toolInjection: { ...draft.toolInjection, toolInput: toolInput as Record<string, unknown> },
    }, '工具注入配置已保存');
  }

  async function copyBaseUrl() {
    try {
      await navigator.clipboard.writeText(baseUrl);
      setNotice('专用 Base URL 已复制');
    } catch {
      setError('复制失败，请手动复制地址');
    }
  }

  async function clearHistory() {
    if (!(await confirm({
      title: '清空改写历史？',
      description: '只会删除 Security Lab 的演示记录，不影响普通请求日志。',
      confirmText: '清空历史',
    }))) return;
    setPending('clear-history');
    try {
      const response = await requestJson<{ deleted: number }>('/api/admin/security-lab/history', { method: 'DELETE' });
      setNotice(`已清理 ${response.deleted} 条改写历史`);
      await loadHistory();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : '历史清理失败');
    } finally {
      setPending(null);
    }
  }

  const armedCount = Number(Boolean(config?.promptInjection.enabled)) + Number(Boolean(config?.toolInjection.enabled));
  const armedLabel = armedCount === 0 ? '未武装' : armedCount === 1 ? '部分开启' : '已武装';
  const armedVariant = armedCount === 0 ? 'outline' : armedCount === 1 ? 'warning' : 'destructive';

  return (
    <div className="space-y-5">
      <Card className={armedCount > 0 ? 'border-destructive/30' : undefined}>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-md ${armedCount > 0 ? 'bg-destructive-soft text-destructive' : 'bg-muted text-muted-foreground'}`}>
              {armedCount > 0 ? <ShieldAlert className="size-5" aria-hidden="true" /> : <RadioTower className="size-5" aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Claude Code 专用入口</h2>
                <Badge variant={armedVariant}>{armedLabel}</Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">只有这个 Base URL 会执行改写；正常 <code>/v1/messages</code> 不受影响。</p>
              <code className="mt-2 block break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">{baseUrl}</code>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={copyBaseUrl} className="shrink-0">
            <Copy className="size-4" aria-hidden="true" />复制 Base URL
          </Button>
        </CardContent>
      </Card>

      {error && <div role="alert" className="rounded-md border border-destructive/25 bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-md border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">{notice}</div>}

      <div className="grid gap-4 xl:grid-cols-2">
        <PromptRewriteCard
          value={draft.promptInjection}
          loading={!config}
          pending={pending === '提示词注入配置已保存'}
          onChange={(promptInjection) => setDraft((current) => ({ ...current, promptInjection }))}
          onSave={savePrompt}
        />
        <ToolRewriteCard
          value={draft.toolInjection}
          inputText={toolInputText}
          loading={!config}
          pending={pending === '工具注入配置已保存'}
          onChange={(toolInjection) => setDraft((current) => ({ ...current, toolInjection }))}
          onInputTextChange={setToolInputText}
          onSave={saveTool}
        />
      </div>

      <RewriteHistory
        page={history}
        loading={!config}
        clearing={pending === 'clear-history'}
        onRefresh={() => { void loadHistory(); }}
        onClear={() => { void clearHistory(); }}
        onSelect={setSelected}
      />
      <RewriteHistoryDetail record={selected} onOpenChange={(open) => { if (!open) setSelected(null); }} />
    </div>
  );
}
