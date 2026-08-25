'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { SkeletonRows } from '@/components/empty-state';
import { cardCls, tableHeadCls, tableWrapCls } from '@/components/ui/styles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPreset } from '@/lib/presets';
import { buildActivityCalendar, monthLabelGridColumn } from '@/lib/services/usage-chart';

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

function DashboardSelect({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <Select value={value || '__all'} onValueChange={(next) => onValueChange(next === '__all' ? '' : next)}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value || '__all'} value={option.value || '__all'}>{option.label}</SelectItem>)}</SelectContent></Select>;
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

function TrendChart({ data, bucket }: { data: TrendPoint[]; bucket: 'hour' | 'day' }) {
  const axisLabel = (start: string) => bucket === 'hour' ? start.slice(11, 16) : start.slice(5, 10).replace('-', '/');
  if (!data.length) return <div className="flex h-72 items-center justify-center text-sm text-subtle-foreground">当前时间范围暂无趋势数据</div>;
  const latest = data.at(-1)!;
  return (
    <div className="h-[320px] w-full" role="img" aria-label="Token 用量与成本趋势">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="start" tickFormatter={axisLabel} tick={{ fill: 'var(--subtle-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis yAxisId="tokens" tickFormatter={fmtTokens} tick={{ fill: 'var(--subtle-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} width={54} />
          <YAxis yAxisId="cost" orientation="right" tickFormatter={fmtCost} tick={{ fill: 'var(--subtle-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} width={58} />
          <RechartsTooltip
            cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 12px 36px rgba(0,0,0,.16)', fontSize: 12 }}
            labelFormatter={(label) => String(label).replace('T', ' ').slice(0, 16)}
            formatter={(value, name) => [name === '成本' ? fmtCost(Number(value)) : fmtTokens(Number(value)), name]}
          />
          <Area yAxisId="tokens" type="monotone" dataKey="cache_read_tokens" name="缓存命中" stroke="var(--chart-cache-read)" fill="var(--chart-cache-read)" fillOpacity={0.12} strokeWidth={2} />
          <Line yAxisId="tokens" type="monotone" dataKey="input_tokens" name="输入" stroke="var(--chart-input)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          <Line yAxisId="tokens" type="monotone" dataKey="output_tokens" name="输出" stroke="var(--chart-output)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          <Line yAxisId="tokens" type="monotone" dataKey="cache_write_tokens" name="缓存创建" stroke="var(--chart-cache-write)" strokeWidth={1.8} dot={false} />
          <Line yAxisId="cost" type="monotone" dataKey="cost" name="成本" stroke="var(--chart-cost)" strokeWidth={1.8} strokeDasharray="5 5" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <span className="sr-only">最近数据点：输入 {fmtTokens(latest.input_tokens)}，输出 {fmtTokens(latest.output_tokens)}，成本 {fmtCost(latest.cost)}</span>
    </div>
  );
}

function ActivityHeatmap({ data }: { data: UsageData['activity'] }) {
  const calendar = useMemo(() => buildActivityCalendar(data), [data]);
  const max = Math.max(1, ...data.map((day) => day.effective_tokens));
  const containerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const [focusedDay, setFocusedDay] = useState(data.at(-1)?.day ?? '');
  const [hovered, setHovered] = useState<{ day: UsageData['activity'][number]; left: number; top: number; below: boolean } | null>(null);
  const level = (tokens: number) => tokens === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(Math.sqrt(tokens / max) * 4)));
  const tones = ['bg-muted', 'bg-primary/20', 'bg-primary/40', 'bg-primary/65', 'bg-primary'];
  const showTooltip = (element: HTMLElement, day: UsageData['activity'][number]) => {
    const root = containerRef.current?.getBoundingClientRect();
    const cell = element.getBoundingClientRect();
    if (!root) return;
    setHovered({
      day,
      left: Math.max(92, Math.min(root.width - 92, cell.left - root.left + cell.width / 2)),
      top: cell.top - root.top < 66 ? cell.bottom - root.top + 8 : cell.top - root.top - 8,
      below: cell.top - root.top < 66,
    });
  };
  const moveFocus = (currentDay: string, key: string) => {
    const current = data.findIndex((item) => item.day === currentDay);
    if (current < 0) return;
    const offsets: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    const targetIndex = key === 'Home'
      ? 0
      : key === 'End'
        ? data.length - 1
        : Math.min(data.length - 1, Math.max(0, current + (offsets[key] ?? 0)));
    const target = data[targetIndex];
    if (!target || targetIndex === current) return;
    setFocusedDay(target.day);
    window.requestAnimationFrame(() => cellRefs.current.get(target.day)?.focus());
  };

  return <div ref={containerRef} className="relative w-full pt-1">
    <div className="grid w-full gap-0.5 sm:gap-[3px]" style={{ gridTemplateColumns: `repeat(${Math.max(1, calendar.weeks.length)}, minmax(0, 1fr))` }}>
      {calendar.weeks.map((week, weekIndex) => <div key={weekIndex} className="grid min-w-0 grid-rows-7 gap-0.5 sm:gap-[3px]">
        {week.map((day, weekday) => day ? <button
          key={day.day}
          type="button"
          ref={(node) => { if (node) cellRefs.current.set(day.day, node); else cellRefs.current.delete(day.day); }}
          tabIndex={focusedDay === day.day ? 0 : -1}
          className={`aspect-square w-full min-w-0 rounded-[2px] outline-none transition-[filter,transform] duration-150 hover:brightness-90 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${tones[level(day.effective_tokens)]}`}
          aria-label={`${day.day}，当日 Token 总数 ${fmtTokens(day.effective_tokens)}`}
          onMouseEnter={(event) => showTooltip(event.currentTarget, day)}
          onMouseLeave={() => setHovered(null)}
          onFocus={(event) => { setFocusedDay(day.day); showTooltip(event.currentTarget, day); }}
          onBlur={() => setHovered(null)}
          onKeyDown={(event) => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            moveFocus(day.day, event.key);
          }}
        /> : <span key={`${weekIndex}-${weekday}`} className="aspect-square w-full" aria-hidden="true" />)}
      </div>)}
    </div>
    <div className="mt-2 grid h-4 w-full gap-0.5 text-[10px] text-subtle-foreground sm:gap-[3px]" style={{ gridTemplateColumns: `repeat(${Math.max(1, calendar.weeks.length)}, minmax(0, 1fr))` }}>
      {calendar.months.map((month) => <span key={`${month.label}-${month.week}`} className="whitespace-nowrap" style={{ gridColumn: monthLabelGridColumn(month.week, calendar.weeks.length) }}>{month.label}</span>)}
    </div>
    {hovered && <div
      role="tooltip"
      className="pointer-events-none absolute z-20 w-44 rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground shadow-[0_6px_20px_rgba(0,0,0,0.14)]"
      style={{ left: hovered.left, top: hovered.top, transform: `translate(-50%, ${hovered.below ? '0' : '-100%'})` }}
    >
      <div className="font-medium">{hovered.day.day}</div>
      <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground"><span>当日 Token 总数</span><span className="font-mono font-medium tabular-nums text-foreground">{fmtTokens(hovered.day.effective_tokens)}</span></div>
    </div>}
  </div>;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const filterControls = <>
    <DashboardSelect label="网关令牌" value={token} onValueChange={setToken} options={[{ value: '', label: '全部令牌' }, ...tokens.map((item) => ({ value: item.id, label: `${item.name} · ${item.prefix}` }))]} />
    <DashboardSelect label="服务商" value={provider} onValueChange={(next) => { setProvider(next); setModel(''); }} options={[{ value: '', label: '全部服务商' }, ...providers.map((item) => ({ value: item.id, label: item.name }))]} />
    <DashboardSelect label="模型" value={model} onValueChange={setModel} options={[{ value: '', label: '全部模型' }, ...visibleModels.filter((item) => item.enabled).map((item) => ({ value: item.model_id, label: item.display_name ?? item.model_id }))]} />
    <DashboardSelect label="时间范围" value={range} onValueChange={(next) => setRange(next as RangePreset)} options={[{ value: 'today', label: '当天' }, { value: '7d', label: '近 7 天' }, { value: '30d', label: '近 30 天' }, { value: 'custom', label: '自定义' }]} />
    <DashboardSelect label="自动刷新" value={refresh} onValueChange={setRefresh} options={[{ value: '0', label: '不自动刷新' }, { value: '30', label: '每 30 秒' }, { value: '60', label: '每 60 秒' }, { value: '300', label: '每 5 分钟' }]} />
    {range === 'custom' && <div className="col-span-full flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center"><label className="flex items-center gap-2 text-xs text-muted-foreground">开始<Input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} /></label><label className="flex items-center gap-2 text-xs text-muted-foreground">结束<Input type="date" value={customTo} min={customFrom} max={todayInput()} onChange={(event) => setCustomTo(event.target.value)} /></label><span className="text-xs text-subtle-foreground">最长 90 天；48 小时以内按小时显示</span></div>}
  </>;

  return (
    <div className="space-y-6">
      <section className={`${cardCls} hidden p-4 md:block`} aria-label="用量筛选">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
          {filterControls}
        </div>
      </section>
      <Button type="button" variant="outline" onClick={() => setFiltersOpen(true)} className="w-full md:hidden"><SlidersHorizontal className="size-4" />筛选用量范围</Button>
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}><SheetContent side="bottom"><SheetHeader><SheetTitle>筛选用量</SheetTitle><SheetDescription>选择统计范围，数据和地址栏查询参数会自动更新。</SheetDescription></SheetHeader><SheetBody><div className="grid gap-3">{filterControls}</div><Button className="mt-5 w-full" onClick={() => setFiltersOpen(false)}>查看结果</Button></SheetBody></SheetContent></Sheet>

      {error && <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</div>}

      <section className={`${cardCls} overflow-hidden`} aria-labelledby="usage-overview-heading">
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-[1.4fr_.8fr_.8fr]">
          <div className="col-span-2 bg-surface p-5 sm:p-6 lg:col-span-1"><div id="usage-overview-heading" className="text-xs text-muted-foreground">真实消耗 Tokens</div><div className="mt-2 text-3xl font-semibold tracking-[-0.04em] tabular-nums sm:text-4xl">{overview ? fmtTokens(overview.effective_tokens) : '—'}</div><div className="mt-2 text-xs text-subtle-foreground">缓存指标覆盖 {overview ? fmtPercent(overview.cache_coverage) : '—'}</div></div>
          <div className="bg-surface p-5 sm:p-6"><div className="text-xs text-muted-foreground">总请求数</div><div className="mt-3 text-2xl font-semibold tabular-nums">{overview?.requests.toLocaleString('zh-CN') ?? '—'}</div><div className="mt-2 text-xs text-subtle-foreground">成功率 {overview ? fmtPercent(overview.success_rate) : '—'}</div></div>
          <div className="bg-surface p-5 sm:p-6"><div className="text-xs text-muted-foreground">估算成本</div><div className="mt-3 text-2xl font-semibold tabular-nums text-success">{overview ? fmtCost(overview.cost) : '—'}</div><div className="mt-2 text-xs text-subtle-foreground">已定价 {overview?.priced_requests ?? 0} 次</div></div>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border lg:grid-cols-5">{metricCards.map((item) => <div key={item.label} className="bg-surface px-4 py-4 sm:px-5"><div className="text-[11px] text-muted-foreground">{item.label}</div><div className={`mt-1 text-base font-semibold tabular-nums ${item.tone}`}>{item.value}</div></div>)}</div>
      </section>

      <section className={`${cardCls} p-5 sm:p-6`} aria-labelledby="trend-heading"><div className="mb-5 flex items-center justify-between gap-4"><h2 id="trend-heading" className="text-sm font-semibold">使用趋势</h2><span className="text-xs text-subtle-foreground">{usage?.range.bucket === 'hour' ? '小时' : '自然日'}粒度</span></div>{loading && !usage ? <SkeletonRows rows={4} /> : <TrendChart data={usage?.trend ?? []} bucket={usage?.range.bucket ?? 'hour'} />}</section>

      <section className={`${cardCls} p-5 sm:p-6`} aria-labelledby="activity-heading"><div className="mb-5 flex items-end justify-between gap-4"><div><h2 id="activity-heading" className="text-sm font-semibold">Token 活跃度</h2><p className="mt-1 text-xs text-muted-foreground">最近 365 天，响应当前令牌、服务商和模型筛选</p></div><span className="text-xs text-subtle-foreground">越深表示用量越高</span></div>{usage ? <ActivityHeatmap data={usage.activity} /> : <SkeletonRows rows={2} />}</section>

      <section aria-labelledby="breakdown-heading">
        <Tabs value={breakdown} onValueChange={(value) => setBreakdown(value as Breakdown)} className="mb-3"><TabsList aria-label="统计维度"><TabsTrigger value="token">网关令牌</TabsTrigger><TabsTrigger value="provider">Provider</TabsTrigger><TabsTrigger value="model">模型</TabsTrigger></TabsList></Tabs>
        <h2 id="breakdown-heading" className="sr-only">多维统计</h2>
        <div className={tableWrapCls}><table className="min-w-[880px] w-full text-sm"><thead className={tableHeadCls}><tr><th className="px-4 py-3 font-medium">{breakdown === 'token' ? '令牌' : breakdown === 'provider' ? '服务商' : '模型'}</th><th className="px-4 py-3 text-right font-medium">请求数</th><th className="px-4 py-3 text-right font-medium">Tokens</th><th className="px-4 py-3 text-right font-medium">成本</th><th className="px-4 py-3 text-right font-medium">成功率</th><th className="px-4 py-3 text-right font-medium">平均耗时</th></tr></thead><tbody className="divide-y divide-border">{!usage ? <tr><td colSpan={6}><SkeletonRows rows={3} /></td></tr> : !rows?.length ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-subtle-foreground">当前筛选范围暂无用量</td></tr> : rows.map((row, index) => <tr key={`${rowName(row)}-${index}`} className="hover:bg-muted/35"><td className="px-4 py-3 font-medium">{rowName(row)}</td><td className="px-4 py-3 text-right tabular-nums">{row.requests.toLocaleString('zh-CN')}</td><td className="px-4 py-3 text-right tabular-nums">{fmtTokens(row.effective_tokens)}</td><td className="px-4 py-3 text-right tabular-nums">{fmtCost(row.cost)}</td><td className="px-4 py-3 text-right tabular-nums">{fmtPercent(row.success_rate)}</td><td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtDuration(row.avg_duration_ms)}</td></tr>)}</tbody></table></div>
      </section>

      <section className={`${cardCls} p-5`} aria-labelledby="balances-heading"><h2 id="balances-heading" className="mb-4 text-sm font-semibold">服务商余额</h2>{!balances ? <SkeletonRows rows={2} /> : balances.length === 0 ? <div className="py-5 text-sm text-subtle-foreground">暂无启用的服务商</div> : <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">{balances.map((entry) => { const logo = getPreset(entry.slug)?.logo; return <div key={entry.provider_id} className="flex min-w-0 items-center justify-between gap-4 border-t border-border pt-3 text-sm"><span className="flex min-w-0 items-center gap-2">{logo ? <img src={logo} alt="" className="h-5 w-5 rounded object-contain" /> : <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px]">{entry.name.slice(0, 1)}</span>}<span className="truncate">{entry.name}</span></span>{entry.result.supported === false ? <span className="shrink-0 text-subtle-foreground">不支持</span> : entry.result.error ? <span className="truncate text-destructive" title={entry.result.error}>{entry.result.error}</span> : <span className={`shrink-0 font-medium ${balanceTone(entry.result.tiers)}`}>{entry.result.summary}</span>}</div>; })}</div>}</section>
    </div>
  );
}
