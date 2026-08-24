'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { btn, inputCls, tableHeadCls, tableWrapCls } from '@/components/ui';

interface Provider { id: string; name: string; slug: string; }
interface Token { id: string; name: string; prefix: string; }

interface LogRow {
  id: string;
  ts: number;
  provider_id: string | null;
  provider_name: string | null;
  provider_slug: string | null;
  model_id: string | null;
  alias: string | null;
  prompt_id: string | null;
  status: number | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost: number | null;
  error: string | null;
  stream: number | null;
  token_id: string | null;
  token_name: string | null;
  token_prefix: string | null;
  client_key: string | null;
  client_name: string | null;
  entry_protocol: string | null;
  source: string | null;
  uncached_input_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  cache_metrics_observed: number | null;
  first_token_ms: number | null;
  duration_ms: number | null;
  provider_endpoint_id: string | null;
  upstream_protocol: string | null;
}

const DAY = 86_400_000;
const ENTRY_LABELS: Record<string, string> = {
  openai: 'Chat',
  responses: 'Responses',
  anthropic: 'Messages',
};

function rangeFrom(range: string): number | undefined {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (range === 'today') return todayStart;
  if (range === '7d') return todayStart - 6 * DAY;
  if (range === '30d') return todayStart - 29 * DAY;
  return undefined;
}

function fmtTokens(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('zh-CN').format(value);
}

function fmtCost(value: number | null): string {
  if (value == null) return '—';
  return value >= 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(6)}`;
}

function fmtDuration(value: number | null): string {
  if (value == null) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value}ms`;
}

export default function LogsClient() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filters, setFilters] = useState({ provider: '', token: '', entry: '', status: '', range: 'today', q: '' });
  const logRequestId = useRef(0);
  const pageSize = 50;

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/providers').then((response) => response.json()),
      fetch('/api/admin/tokens').then((response) => response.json()),
    ]).then(([providerData, tokenData]) => {
      setProviders(providerData.providers ?? []);
      setTokens(tokenData.tokens ?? []);
    });
  }, []);

  const load = useCallback(async () => {
    const requestId = ++logRequestId.current;
    setLoading(true);
    setLoadError('');
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (filters.provider) params.set('provider', filters.provider);
    if (filters.token) params.set('token', filters.token);
    if (filters.entry) params.set('entry', filters.entry);
    if (filters.status) params.set('status', filters.status);
    if (filters.q) params.set('q', filters.q);
    const from = rangeFrom(filters.range);
    if (from != null) params.set('from', String(from));
    try {
      const response = await fetch(`/api/admin/logs?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '日志加载失败');
      if (requestId !== logRequestId.current) return;
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch (reason) {
      if (requestId !== logRequestId.current) return;
      setLoadError(reason instanceof Error ? reason.message : '日志加载失败');
    } finally {
      if (requestId === logRequestId.current) setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  function applyFilters(patch: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  return (
    <div>
      <section className="mb-5 rounded-lg border border-border bg-surface p-4" aria-label="日志筛选">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto_1.1fr]">
          <select aria-label="网关令牌" value={filters.token} onChange={(event) => applyFilters({ token: event.target.value })} className={inputCls}><option value="">全部令牌</option>{tokens.map((token) => <option key={token.id} value={token.id}>{token.name} · {token.prefix}</option>)}</select>
          <select aria-label="服务商" value={filters.provider} onChange={(event) => applyFilters({ provider: event.target.value })} className={inputCls}><option value="">全部服务商</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select>
          <select aria-label="入口协议" value={filters.entry} onChange={(event) => applyFilters({ entry: event.target.value })} className={inputCls}><option value="">全部入口</option><option value="openai">Chat</option><option value="responses">Responses</option><option value="anthropic">Messages</option></select>
          <select aria-label="请求状态" value={filters.status} onChange={(event) => applyFilters({ status: event.target.value })} className={inputCls}><option value="">全部状态</option><option value="2xx">成功</option><option value="error">失败</option></select>
          <select aria-label="时间范围" value={filters.range} onChange={(event) => applyFilters({ range: event.target.value })} className={inputCls}><option value="today">当天</option><option value="7d">近 7 天</option><option value="30d">近 30 天</option><option value="">全部时间</option></select>
          <input aria-label="搜索错误摘要" value={filters.q} onChange={(event) => applyFilters({ q: event.target.value })} placeholder="搜索错误摘要…" className={inputCls} />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-subtle-foreground"><span>记录请求元数据，不保存请求或响应正文</span><span className="tabular-nums">共 {total.toLocaleString('zh-CN')} 条</span></div>
      </section>

      {loadError && <div className="mb-4 rounded-lg border border-destructive/25 bg-destructive-soft px-4 py-3 text-sm text-destructive" role="alert">{loadError}</div>}

      <div className={tableWrapCls}>
        <table className="min-w-[1240px] w-full text-sm">
          <thead className={tableHeadCls}><tr><th className="px-4 py-3 font-medium">时间</th><th className="px-4 py-3 font-medium">令牌</th><th className="px-4 py-3 font-medium">入口</th><th className="px-4 py-3 font-medium">服务商 / 模型</th><th className="px-4 py-3 text-right font-medium">输入</th><th className="px-4 py-3 text-right font-medium">输出</th><th className="px-4 py-3 text-right font-medium">成本</th><th className="px-4 py-3 text-right font-medium">总耗时 / 首字</th><th className="px-4 py-3 font-medium">状态</th><th className="px-4 py-3 font-medium">来源</th></tr></thead>
          <tbody className="divide-y divide-border">
            {loading ? <tr><td colSpan={10}><SkeletonRows rows={5} /></td></tr> : logs.length === 0 ? <tr><td colSpan={10}><EmptyState title="暂无日志" description="当前筛选范围内没有请求记录" /></td></tr> : logs.map((log) => {
              const success = log.status != null && log.status >= 200 && log.status < 300;
              const input = log.cache_metrics_observed === 1 ? log.uncached_input_tokens : log.prompt_tokens;
              return (
                <Fragment key={log.id}>
                  <tr className={`${log.error && !success ? 'bg-destructive-soft/25' : ''} hover:bg-muted/35`}>
                    <td className="px-4 py-3 whitespace-nowrap"><button type="button" aria-expanded={expanded === log.id} onClick={() => setExpanded(expanded === log.id ? null : log.id)} className="text-left text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{new Date(log.ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</button></td>
                    <td className="px-4 py-3"><div className="font-medium">{log.token_name ?? '已删除令牌'}</div><div className="mt-0.5 font-mono text-[11px] text-subtle-foreground">{log.token_prefix ?? '—'}</div></td>
                    <td className="px-4 py-3"><span className="rounded border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground">{ENTRY_LABELS[log.entry_protocol ?? ''] ?? log.entry_protocol ?? '旧记录'}</span></td>
                    <td className="px-4 py-3"><div>{log.provider_name ?? log.provider_slug ?? '—'}</div><div className="mt-0.5 max-w-64 truncate font-mono text-[11px] text-muted-foreground" title={log.model_id ?? ''}>{log.model_id ?? '—'}</div></td>
                    <td className="px-4 py-3 text-right tabular-nums"><div>{fmtTokens(input)}</div><div className="mt-0.5 text-[10px] text-subtle-foreground">{log.cache_metrics_observed === 1 ? `读 ${fmtTokens(log.cache_read_tokens)} · 写 ${fmtTokens(log.cache_write_tokens)}` : '缓存未知'}</div></td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtTokens(log.completion_tokens)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtCost(log.cost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums"><div>{fmtDuration(log.duration_ms ?? log.latency_ms)}</div><div className="mt-0.5 text-[10px] text-subtle-foreground">首字 {fmtDuration(log.first_token_ms)}</div></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${success ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive'}`}>{log.status ?? '—'}</span></td>
                    <td className="px-4 py-3"><div className="max-w-56 truncate font-mono text-[11px] text-muted-foreground" title={log.source ?? 'unknown'}>{log.source ?? 'unknown'}</div></td>
                  </tr>
                  {expanded === log.id && <tr><td colSpan={10} className="bg-muted/45 px-4 py-4"><div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-subtle-foreground">路由</span><div className="mt-1 font-mono">{[log.provider_slug, log.model_id].filter(Boolean).join('/') || '—'}</div></div><div><span className="text-subtle-foreground">实际端点 / 上游格式</span><div className="mt-1 font-mono">{log.provider_endpoint_id ?? '旧记录'} / {log.upstream_protocol ?? '—'}</div></div><div><span className="text-subtle-foreground">请求别名 / 提示词</span><div className="mt-1 font-mono">{log.alias ?? '—'} / {log.prompt_id ?? '—'}</div></div><div><span className="text-subtle-foreground">上游响应头</span><div className="mt-1 tabular-nums">{fmtDuration(log.latency_ms)} · {log.stream === 1 ? '流式' : '非流式'}</div></div><div><span className="text-subtle-foreground">原始 Token</span><div className="mt-1 tabular-nums">{fmtTokens(log.prompt_tokens)} + {fmtTokens(log.completion_tokens)} = {fmtTokens(log.total_tokens)}</div></div><div className="sm:col-span-2 lg:col-span-4"><span className="text-subtle-foreground">来源 User-Agent</span><div className="mt-1 break-all font-mono">{log.source ?? 'unknown'}</div></div></div>{log.error ? <pre className={`mt-4 whitespace-pre-wrap rounded-md border px-3 py-3 text-xs ${success ? 'border-warning/25 bg-warning-soft text-warning' : 'border-destructive/25 bg-destructive-soft text-destructive'}`}>{log.error}</pre> : <div className="mt-4 text-xs text-subtle-foreground">请求完成，无错误或 failover 备注。</div>}</td></tr>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-sm"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className={btn.ghost}>上一页</button><span className="min-w-20 text-center text-muted-foreground">{page} / {totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages} className={btn.ghost}>下一页</button></div>
    </div>
  );
}
