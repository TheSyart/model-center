'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SkeletonRows } from '@/components/empty-state';
import { cardCls, inputCls, tableHeadCls, tableWrapCls } from '@/components/ui';
import { getPreset } from '@/lib/presets';

type RangePreset = 'today' | '7d' | '30d' | 'custom';
type Breakdown = 'token' | 'provider' | 'model';

interface Provider { id: string; name: string; slug: string; }
interface Model { id: string; provider_id: string; model_id: string; display_name: string | null; enabled: boolean; }
interface Token { id: string; name: string; prefix: string; }

interface UsageAggregate {
  requests: number;
  success: number;
  success_rate: number | null;
  effective_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cache_hit_rate: number | null;
  cost: number;
  priced_requests: number;
  avg_duration_ms: number | null;
  avg_first_token_ms: number | null;
  cache_coverage: number | null;
}

interface UsageRow extends UsageAggregate {
  token_id?: string | null;
  token_name?: string | null;
  token_prefix?: string | null;
  provider_id?: string | null;
  provider_name?: string | null;
  provider_slug?: string | null;
  model_id?: string | null;
}

interface TrendPoint {
  start: string;
  requests: number;
  effective_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost: number;
}

interface UsageData {
  range: { from: number; to: number; bucket: 'hour' | 'day' };
  overview: UsageAggregate;
  trend: TrendPoint[];
  by_token: UsageRow[];
  by_provider: UsageRow[];
  by_model: UsageRow[];
  activity: Array<{ day: string; requests: number; effective_tokens: number; cost: number }>;
}

interface BalanceEntry {
  provider_id: string;
  slug: string;
  name: string;
  result: { supported: boolean; summary?: string; error?: string; console_url?: string; tiers?: { utilization: number }[] };
}

const DAY = 86_400_000;

function fmtTokens(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 1_000_000 ? 0 : 1)}万`;
  return new Intl.NumberFormat('zh-CN').format(value);
}

function fmtCost(value: number): string {
  return value >= 0.01 ? `$${value.toFixed(2)}` : `$${value.toFixed(6)}`;
}

function fmtPercent(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function fmtDuration(value: number | null): string {
  if (value == null) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

function todayInput(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * DAY);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function rangeBounds(range: RangePreset, customFrom: string, customTo: string) {
  const now = Date.now();
  const date = new Date(now);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (range === 'today') return { from: start, to: now, bucket: 'hour' as const };
  if (range === '7d') return { from: start - 6 * DAY, to: now, bucket: 'day' as const };
  if (range === '30d') return { from: start - 29 * DAY, to: now, bucket: 'day' as const };
  const from = new Date(`${customFrom}T00:00:00`).getTime();
  const to = new Date(`${customTo}T00:00:00`).getTime() + DAY;
  return { from, to, bucket: to - from <= 48 * 3_600_000 ? ('hour' as const) : ('day' as const) };
}

function pathFor(values: number[], width: number, height: number, left: number, top: number, max: number): string {
  if (!values.length) return '';
  const usableWidth = width - left - 58;
  const usableHeight = height - top - 40;
  return values.map((value, index) => {
    const x = left + (values.length === 1 ? usableWidth / 2 : (index / (values.length - 1)) * usableWidth);
    const y = top + usableHeight - (value / Math.max(1, max)) * usableHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function TrendChart({ data, bucket }: { data: TrendPoint[]; bucket: 'hour' | 'day' }) {
  const width = 1000;
  const height = 300;
  const left = 58;
  const tokenMax = Math.max(1, ...data.flatMap((point) => [point.input_tokens, point.output_tokens, point.cache_read_tokens, point.cache_write_tokens]));
  const costMax = Math.max(0.000001, ...data.map((point) => point.cost));
  const series = [
    { key: 'input_tokens' as const, label: '输入', color: 'var(--chart-input)' },
    { key: 'output_tokens' as const, label: '输出', color: 'var(--chart-output)' },
    { key: 'cache_read_tokens' as const, label: '缓存命中', color: 'var(--chart-cache-read)' },
    { key: 'cache_write_tokens' as const, label: '缓存创建', color: 'var(--chart-cache-write)' },
  ];
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="minimal-scrollbar overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] min-w-[760px] w-full" role="img" aria-label="Token 用量与成本趋势">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = 22 + (height - 62) * ratio;
          return <g key={ratio}><line x1={left} x2={width - 58} y1={y} y2={y} stroke="var(--border)" strokeDasharray="2 6" /><text x={left - 9} y={y + 4} textAnchor="end" fill="var(--subtle-foreground)" fontSize="10">{fmtTokens(Math.round(tokenMax * (1 - ratio)))}</text><text x={width - 52} y={y + 4} fill="var(--subtle-foreground)" fontSize="10">{fmtCost(costMax * (1 - ratio))}</text></g>;
        })}
        {series.map((item) => <path key={item.key} d={pathFor(data.map((point) => point[item.key]), width, height, left, 22, tokenMax)} fill="none" stroke={item.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)}
        <path d={pathFor(data.map((point) => point.cost), width, height, left, 22, costMax)} fill="none" stroke="var(--chart-cost)" strokeWidth="1.8" strokeDasharray="5 5" strokeLinejoin="round" />
        {data.map((point, index) => {
          const x = left + (data.length === 1 ? (width - left - 58) / 2 : (index / (data.length - 1)) * (width - left - 58));
          const label = bucket === 'hour' ? point.start.slice(11, 16) : point.start.slice(5);
          return <g key={point.start}>{index % labelEvery === 0 && <text x={x} y={height - 15} textAnchor="middle" fill="var(--subtle-foreground)" fontSize="10">{label}</text>}<circle cx={x} cy={height / 2} r="13" fill="transparent"><title>{`${point.start} · ${point.requests} 次 · ${fmtTokens(point.effective_tokens)} Tokens · ${fmtCost(point.cost)}`}</title></circle></g>;
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {series.map((item) => <span key={item.key} className="flex items-center gap-1.5"><i className="h-0.5 w-4" style={{ background: item.color }} />{item.label}</span>)}
        <span className="flex items-center gap-1.5"><i className="h-0 w-4 border-t border-dashed border-chart-cost" />成本</span>
      </div>
    </div>
  );
}

function ActivityHeatmap({ data }: { data: UsageData['activity'] }) {
  const max = Math.max(1, ...data.map((day) => day.effective_tokens));
  const leading = data.length ? new Date(`${data[0].day}T00:00:00`).getDay() : 0;
  const cells = [...Array.from({ length: leading }, () => null), ...data];
  const level = (tokens: number) => tokens === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(Math.sqrt(tokens / max) * 4)));
  const tones = ['bg-muted', 'bg-primary/20', 'bg-primary/40', 'bg-primary/65', 'bg-primary'];
  return <div className="minimal-scrollbar overflow-x-auto pb-2"><div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">{cells.map((day, index) => day ? <div key={day.day} className={`h-2.5 w-2.5 rounded-[2px] ${tones[level(day.effective_tokens)]}`} title={`${day.day} · ${day.requests} 次 · ${fmtTokens(day.effective_tokens)} Tokens · ${fmtCost(day.cost)}`} /> : <span key={`blank-${index}`} className="h-2.5 w-2.5" aria-hidden="true" />)}</div></div>;
}

function balanceTone(tiers?: { utilization: number }[]): string {
  if (!tiers?.length) return 'text-success';
  const highest = Math.max(...tiers.map((tier) => tier.utilization));
  if (highest >= 90) return 'text-destructive';
  if (highest >= 70) return 'text-warning';
  return 'text-success';
}

export default function DashboardClient() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [balances, setBalances] = useState<BalanceEntry[] | null>(null);
  const [range, setRange] = useState<RangePreset>('today');
  const [customFrom, setCustomFrom] = useState(todayInput(-6));
  const [customTo, setCustomTo] = useState(todayInput());
  const [token, setToken] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [refresh, setRefresh] = useState('30');
  const [breakdown, setBreakdown] = useState<Breakdown>('token');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const usageRequestId = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedRange = params.get('range');
    if (savedRange === 'today' || savedRange === '7d' || savedRange === '30d' || savedRange === 'custom') setRange(savedRange);
    setToken(params.get('token') ?? '');
    setProvider(params.get('provider') ?? '');
    setModel(params.get('model') ?? '');
    if (params.get('from')) setCustomFrom(params.get('from')!);
    if (params.get('to')) setCustomTo(params.get('to')!);
    const savedRefresh = localStorage.getItem('model-center-usage-refresh') ?? params.get('refresh');
    if (savedRefresh && ['0', '30', '60', '300'].includes(savedRefresh)) setRefresh(savedRefresh);
    setReady(true);
    Promise.all([fetch('/api/admin/providers').then((response) => response.json()), fetch('/api/admin/models').then((response) => response.json()), fetch('/api/admin/tokens').then((response) => response.json())]).then(([providerData, modelData, tokenData]) => { setProviders(providerData.providers ?? []); setModels(modelData.models ?? []); setTokens(tokenData.tokens ?? []); });
    fetch('/api/admin/balances').then((response) => response.json()).then((data) => setBalances(data.balances ?? [])).catch(() => setBalances([]));
  }, []);

  const bounds = useMemo(() => rangeBounds(range, customFrom, customTo), [range, customFrom, customTo]);
  const loadUsage = useCallback(async () => {
    if (!ready || !Number.isFinite(bounds.from) || !Number.isFinite(bounds.to)) return;
    const requestId = ++usageRequestId.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ from: String(bounds.from), to: String(bounds.to), bucket: bounds.bucket });
    if (token) params.set('token', token);
    if (provider) params.set('provider', provider);
    if (model) params.set('model', model);
    try {
      const response = await fetch(`/api/admin/usage?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '统计数据加载失败');
      if (requestId !== usageRequestId.current) return;
      setUsage(data);
    } catch (reason) {
      if (requestId !== usageRequestId.current) return;
      setError(reason instanceof Error ? reason.message : '统计数据加载失败');
    } finally {
      if (requestId === usageRequestId.current) setLoading(false);
    }
  }, [ready, bounds, token, provider, model]);

  useEffect(() => {
    if (!ready) return;
    void loadUsage();
    const seconds = Number(refresh);
    if (!seconds) return;
    const timer = window.setInterval(loadUsage, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [ready, refresh, loadUsage]);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    params.set('range', range);
    if (token) params.set('token', token);
    if (provider) params.set('provider', provider);
    if (model) params.set('model', model);
    if (range === 'custom') { params.set('from', customFrom); params.set('to', customTo); }
    params.set('refresh', refresh);
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
    localStorage.setItem('model-center-usage-refresh', refresh);
  }, [ready, range, customFrom, customTo, token, provider, model, refresh]);

  const visibleModels = provider ? models.filter((item) => item.provider_id === provider) : models;
  const overview = usage?.overview;
  const metricCards = [
    { label: '输入', value: overview ? fmtTokens(overview.input_tokens) : '—', tone: 'text-chart-input' },
    { label: '输出', value: overview ? fmtTokens(overview.output_tokens) : '—', tone: 'text-chart-output' },
    { label: '缓存读取', value: overview ? fmtTokens(overview.cache_read_tokens) : '—', tone: 'text-chart-cache-read' },
    { label: '缓存写入', value: overview ? fmtTokens(overview.cache_write_tokens) : '—', tone: 'text-chart-cache-write' },
    { label: '缓存命中率', value: overview ? fmtPercent(overview.cache_hit_rate) : '—', tone: 'text-foreground' },
  ];
  const rows = breakdown === 'token' ? usage?.by_token : breakdown === 'provider' ? usage?.by_provider : usage?.by_model;
  const rowName = (row: UsageRow) => breakdown === 'token' ? row.token_name ?? row.token_prefix ?? '未识别令牌' : breakdown === 'provider' ? row.provider_name ?? row.provider_slug ?? '已删除服务商' : [row.provider_slug, row.model_id].filter(Boolean).join('/') || '未知模型';

  return (
    <div className="space-y-6">
      <section className={`${cardCls} p-4`} aria-label="用量筛选">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <select aria-label="网关令牌" value={token} onChange={(event) => setToken(event.target.value)} className={inputCls}><option value="">全部令牌</option>{tokens.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.prefix}</option>)}</select>
          <select aria-label="服务商" value={provider} onChange={(event) => { setProvider(event.target.value); setModel(''); }} className={inputCls}><option value="">全部服务商</option>{providers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select aria-label="模型" value={model} onChange={(event) => setModel(event.target.value)} className={inputCls}><option value="">全部模型</option>{visibleModels.filter((item) => item.enabled).map((item) => <option key={item.id} value={item.model_id}>{item.display_name ?? item.model_id}</option>)}</select>
          <select aria-label="时间范围" value={range} onChange={(event) => setRange(event.target.value as RangePreset)} className={inputCls}><option value="today">当天</option><option value="7d">近 7 天</option><option value="30d">近 30 天</option><option value="custom">自定义</option></select>
          <select aria-label="自动刷新" value={refresh} onChange={(event) => setRefresh(event.target.value)} className={inputCls}><option value="0">不自动刷新</option><option value="30">每 30 秒</option><option value="60">每 60 秒</option><option value="300">每 5 分钟</option></select>
        </div>
        {range === 'custom' && <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3"><label className="flex items-center gap-2 text-xs text-muted-foreground">开始<input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} className={inputCls} /></label><label className="flex items-center gap-2 text-xs text-muted-foreground">结束<input type="date" value={customTo} min={customFrom} max={todayInput()} onChange={(event) => setCustomTo(event.target.value)} className={inputCls} /></label><span className="text-xs text-subtle-foreground">最长 90 天；48 小时以内按小时显示</span></div>}
      </section>

      {error && <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</div>}

      <section className={`${cardCls} overflow-hidden`} aria-labelledby="usage-overview-heading">
        <div className="grid gap-px bg-border lg:grid-cols-[1.4fr_.8fr_.8fr]">
          <div className="bg-surface p-5 sm:p-6"><div id="usage-overview-heading" className="text-xs text-muted-foreground">真实消耗 Tokens</div><div className="mt-2 text-3xl font-semibold tracking-[-0.04em] tabular-nums sm:text-4xl">{overview ? fmtTokens(overview.effective_tokens) : '—'}</div><div className="mt-2 text-xs text-subtle-foreground">缓存指标覆盖 {overview ? fmtPercent(overview.cache_coverage) : '—'}</div></div>
          <div className="bg-surface p-5 sm:p-6"><div className="text-xs text-muted-foreground">总请求数</div><div className="mt-3 text-2xl font-semibold tabular-nums">{overview?.requests.toLocaleString('zh-CN') ?? '—'}</div><div className="mt-2 text-xs text-subtle-foreground">成功率 {overview ? fmtPercent(overview.success_rate) : '—'}</div></div>
          <div className="bg-surface p-5 sm:p-6"><div className="text-xs text-muted-foreground">估算成本</div><div className="mt-3 text-2xl font-semibold tabular-nums text-success">{overview ? fmtCost(overview.cost) : '—'}</div><div className="mt-2 text-xs text-subtle-foreground">已定价 {overview?.priced_requests ?? 0} 次</div></div>
        </div>
        <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-5">{metricCards.map((item) => <div key={item.label} className="bg-surface px-5 py-4"><div className="text-[11px] text-muted-foreground">{item.label}</div><div className={`mt-1 text-base font-semibold tabular-nums ${item.tone}`}>{item.value}</div></div>)}</div>
      </section>

      <section className={`${cardCls} p-5 sm:p-6`} aria-labelledby="trend-heading"><div className="mb-5 flex items-center justify-between gap-4"><h2 id="trend-heading" className="text-sm font-semibold">使用趋势</h2><span className="text-xs text-subtle-foreground">{usage?.range.bucket === 'hour' ? '小时' : '自然日'}粒度</span></div>{loading && !usage ? <SkeletonRows rows={4} /> : <TrendChart data={usage?.trend ?? []} bucket={usage?.range.bucket ?? 'hour'} />}</section>

      <section className={`${cardCls} p-5 sm:p-6`} aria-labelledby="activity-heading"><div className="mb-5 flex items-end justify-between gap-4"><div><h2 id="activity-heading" className="text-sm font-semibold">Token 活跃度</h2><p className="mt-1 text-xs text-muted-foreground">最近 365 天，响应当前令牌、服务商和模型筛选</p></div><span className="text-xs text-subtle-foreground">越深表示用量越高</span></div>{usage ? <ActivityHeatmap data={usage.activity} /> : <SkeletonRows rows={2} />}</section>

      <section aria-labelledby="breakdown-heading">
        <div className="mb-3 flex w-max rounded-md bg-muted p-1" role="tablist" aria-label="统计维度">{([['token', '网关令牌'], ['provider', 'Provider'], ['model', '模型']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={breakdown === key} onClick={() => setBreakdown(key)} className="min-h-9 rounded px-4 text-sm text-muted-foreground transition-colors aria-selected:bg-surface aria-selected:text-foreground aria-selected:shadow-sm">{label}</button>)}</div>
        <h2 id="breakdown-heading" className="sr-only">多维统计</h2>
        <div className={tableWrapCls}><table className="min-w-[880px] w-full text-sm"><thead className={tableHeadCls}><tr><th className="px-4 py-3 font-medium">{breakdown === 'token' ? '令牌' : breakdown === 'provider' ? '服务商' : '模型'}</th><th className="px-4 py-3 text-right font-medium">请求数</th><th className="px-4 py-3 text-right font-medium">Tokens</th><th className="px-4 py-3 text-right font-medium">成本</th><th className="px-4 py-3 text-right font-medium">成功率</th><th className="px-4 py-3 text-right font-medium">平均耗时</th></tr></thead><tbody className="divide-y divide-border">{!usage ? <tr><td colSpan={6}><SkeletonRows rows={3} /></td></tr> : !rows?.length ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-subtle-foreground">当前筛选范围暂无用量</td></tr> : rows.map((row, index) => <tr key={`${rowName(row)}-${index}`} className="hover:bg-muted/35"><td className="px-4 py-3 font-medium">{rowName(row)}</td><td className="px-4 py-3 text-right tabular-nums">{row.requests.toLocaleString('zh-CN')}</td><td className="px-4 py-3 text-right tabular-nums">{fmtTokens(row.effective_tokens)}</td><td className="px-4 py-3 text-right tabular-nums">{fmtCost(row.cost)}</td><td className="px-4 py-3 text-right tabular-nums">{fmtPercent(row.success_rate)}</td><td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtDuration(row.avg_duration_ms)}</td></tr>)}</tbody></table></div>
      </section>

      <section className={`${cardCls} p-5`} aria-labelledby="balances-heading"><h2 id="balances-heading" className="mb-4 text-sm font-semibold">服务商余额</h2>{!balances ? <SkeletonRows rows={2} /> : balances.length === 0 ? <div className="py-5 text-sm text-subtle-foreground">暂无启用的服务商</div> : <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">{balances.map((entry) => { const logo = getPreset(entry.slug)?.logo; return <div key={entry.provider_id} className="flex min-w-0 items-center justify-between gap-4 border-t border-border pt-3 text-sm"><span className="flex min-w-0 items-center gap-2">{logo ? <img src={logo} alt="" className="h-5 w-5 rounded object-contain" /> : <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px]">{entry.name.slice(0, 1)}</span>}<span className="truncate">{entry.name}</span></span>{entry.result.supported === false ? <span className="shrink-0 text-subtle-foreground">不支持</span> : entry.result.error ? <span className="truncate text-destructive" title={entry.result.error}>{entry.result.error}</span> : <span className={`shrink-0 font-medium ${balanceTone(entry.result.tiers)}`}>{entry.result.summary}</span>}</div>; })}</div>}</section>
    </div>
  );
}
