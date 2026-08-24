'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { SkeletonRows } from '@/components/empty-state';
import { cardCls, inputCls, tableHeadCls, tableWrapCls } from '@/components/ui';
import { getPreset } from '@/lib/presets';
import { buildActivityCalendar, chartY, monthLabelGridColumn, nearestTrendIndex, smoothLinePath, type ChartPoint } from '@/lib/services/usage-chart';

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

function TrendChart({ data, bucket }: { data: TrendPoint[]; bucket: 'hour' | 'day' }) {
  const width = 1000;
  const height = 320;
  const left = 58;
  const right = width - 58;
  const top = 22;
  const bottom = height - 44;
  const tokenMax = Math.max(1, ...data.flatMap((point) => [point.input_tokens, point.output_tokens, point.cache_read_tokens, point.cache_write_tokens])) * 1.08;
  const costMax = Math.max(0.000001, ...data.map((point) => point.cost)) * 1.08;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = `cache-area-${useId().replaceAll(':', '')}`;
  const shadowId = `tooltip-shadow-${useId().replaceAll(':', '')}`;
  const liveRegionId = `trend-live-${useId().replaceAll(':', '')}`;
  const series = [
    { key: 'input_tokens' as const, label: '输入', color: 'var(--chart-input)' },
    { key: 'output_tokens' as const, label: '输出', color: 'var(--chart-output)' },
    { key: 'cache_read_tokens' as const, label: '缓存命中', color: 'var(--chart-cache-read)' },
    { key: 'cache_write_tokens' as const, label: '缓存创建', color: 'var(--chart-cache-write)' },
  ];
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const pointsFor = (values: number[], max: number): ChartPoint[] => values.map((value, index) => ({
    x: left + (values.length === 1 ? (right - left) / 2 : (index / (values.length - 1)) * (right - left)),
    y: chartY(value, max, top, bottom),
  }));
  const plottedSeries = series.map((item) => ({ ...item, points: pointsFor(data.map((point) => point[item.key]), tokenMax) }));
  const costPoints = pointsFor(data.map((point) => point.cost), costMax);
  const cachePoints = plottedSeries.find((item) => item.key === 'cache_read_tokens')?.points ?? [];
  const cacheArea = cachePoints.length
    ? `${smoothLinePath(cachePoints)} L ${cachePoints.at(-1)!.x.toFixed(2)} ${bottom} L ${cachePoints[0].x.toFixed(2)} ${bottom} Z`
    : '';
  const hoveredPoint = hoveredIndex == null ? null : data[hoveredIndex];
  const hoverX = hoveredIndex == null ? 0 : plottedSeries[0]?.points[hoveredIndex]?.x ?? left;
  const hoverYs = hoveredIndex == null
    ? []
    : [...plottedSeries.map((item) => item.points[hoveredIndex]?.y ?? bottom), costPoints[hoveredIndex]?.y ?? bottom];
  const tooltipWidth = 196;
  const tooltipHeight = 124;
  const tooltipX = hoverX + 14 + tooltipWidth > right ? hoverX - tooltipWidth - 14 : hoverX + 14;
  const tooltipY = Math.max(top + 4, Math.min(bottom - tooltipHeight - 4, Math.min(...hoverYs, bottom) + 10));
  const axisLabel = (start: string) => bucket === 'hour'
    ? `${start.slice(5, 10).replace('-', '/')} ${start.slice(11, 16)}`
    : start.slice(5, 10).replace('-', '/');
  const tooltipLabel = (start: string) => bucket === 'hour'
    ? `${start.slice(0, 10).replaceAll('-', '/')} ${start.slice(11, 16)}`
    : start.slice(0, 10).replaceAll('-', '/');
  const trendA11yText = hoveredPoint
    ? `${tooltipLabel(hoveredPoint.start)}，输入 ${fmtTokens(hoveredPoint.input_tokens)}，输出 ${fmtTokens(hoveredPoint.output_tokens)}，缓存命中 ${fmtTokens(hoveredPoint.cache_read_tokens)}，缓存创建 ${fmtTokens(hoveredPoint.cache_write_tokens)}，成本 ${fmtCost(hoveredPoint.cost)}`
    : '使用左右方向键查看各时间点明细';
  const updateHoveredIndex = (clientX: number, svg: SVGSVGElement | null) => {
    const rect = svg?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = ((clientX - rect.left) / rect.width) * width;
    setHoveredIndex(nearestTrendIndex(pointerX, left, right, data.length));
  };

  return (
    <div className="minimal-scrollbar overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] min-w-[760px] w-full select-none" role="group" aria-label="Token 用量与成本趋势">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-cache-read)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-cache-read)" stopOpacity="0.01" />
          </linearGradient>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity="0.16" />
          </filter>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + (bottom - top) * ratio;
          return <g key={ratio}><line x1={left} x2={right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="2 6" /><text x={left - 9} y={y + 4} textAnchor="end" fill="var(--subtle-foreground)" fontSize="10">{fmtTokens(Math.round(tokenMax * (1 - ratio)))}</text><text x={right + 7} y={y + 4} fill="var(--subtle-foreground)" fontSize="10">{fmtCost(costMax * (1 - ratio))}</text></g>;
        })}
        {cacheArea && <path d={cacheArea} fill={`url(#${gradientId})`} pointerEvents="none" />}
        {plottedSeries.map((item) => <path key={item.key} d={smoothLinePath(item.points)} fill="none" stroke={item.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />)}
        <path d={smoothLinePath(costPoints)} fill="none" stroke="var(--chart-cost)" strokeWidth="1.8" strokeDasharray="5 5" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />
        {data.map((point, index) => {
          const x = plottedSeries[0]?.points[index]?.x ?? left;
          return (index % labelEvery === 0 || index === data.length - 1) && <text key={point.start} x={x} y={height - 16} textAnchor="middle" fill="var(--subtle-foreground)" fontSize="10">{axisLabel(point.start)}</text>;
        })}
        <rect
          x={left}
          y={top}
          width={right - left}
          height={bottom - top}
          fill="transparent"
          pointerEvents="all"
          tabIndex={0}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, data.length - 1)}
          aria-valuenow={hoveredIndex ?? Math.max(0, data.length - 1)}
          aria-valuetext={trendA11yText}
          aria-describedby={liveRegionId}
          aria-label="悬停或使用左右方向键查看各时间点明细"
          onPointerMove={(event) => updateHoveredIndex(event.clientX, event.currentTarget.ownerSVGElement)}
          onMouseMove={(event) => updateHoveredIndex(event.clientX, event.currentTarget.ownerSVGElement)}
          onPointerLeave={() => setHoveredIndex(null)}
          onMouseLeave={() => setHoveredIndex(null)}
          onFocus={() => setHoveredIndex(data.length ? data.length - 1 : null)}
          onBlur={() => setHoveredIndex(null)}
          onKeyDown={(event) => {
            if (!data.length) return;
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const delta = event.key === 'ArrowLeft' ? -1 : 1;
            setHoveredIndex((current) => Math.min(data.length - 1, Math.max(0, (current ?? data.length - 1) + delta)));
          }}
        />
        {hoveredPoint && hoveredIndex != null && <g role="tooltip" aria-label={`${tooltipLabel(hoveredPoint.start)} 用量明细`} pointerEvents="none">
          <line x1={hoverX} x2={hoverX} y1={top} y2={bottom} stroke="var(--muted-foreground)" strokeWidth="1" opacity="0.75" />
          {plottedSeries.map((item) => <circle key={item.key} cx={item.points[hoveredIndex].x} cy={item.points[hoveredIndex].y} r="4" fill={item.color} stroke="var(--surface)" strokeWidth="2" />)}
          <circle cx={costPoints[hoveredIndex].x} cy={costPoints[hoveredIndex].y} r="4" fill="var(--chart-cost)" stroke="var(--surface)" strokeWidth="2" />
          <g transform={`translate(${tooltipX} ${tooltipY})`} filter={`url(#${shadowId})`}>
            <rect width={tooltipWidth} height={tooltipHeight} rx="8" fill="var(--surface)" stroke="var(--muted-foreground)" />
            <text x="12" y="21" fill="var(--foreground)" fontSize="12" fontWeight="600">{tooltipLabel(hoveredPoint.start)}</text>
            {plottedSeries.map((item, row) => <g key={item.key} transform={`translate(0 ${35 + row * 18})`}><circle cx="13" cy="0" r="3" fill={item.color} /><text x="22" y="4" fill={item.color} fontSize="11">{item.label}: {fmtTokens(hoveredPoint[item.key])}</text></g>)}
            <g transform="translate(0 107)"><circle cx="13" cy="0" r="3" fill="var(--chart-cost)" /><text x="22" y="4" fill="var(--chart-cost)" fontSize="11">成本: {fmtCost(hoveredPoint.cost)}</text></g>
          </g>
        </g>}
      </svg>
      <div id={liveRegionId} className="sr-only" aria-live="polite">{trendA11yText}</div>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {series.map((item) => <span key={item.key} className="flex items-center gap-1.5"><i className="h-0.5 w-4" style={{ background: item.color }} />{item.label}</span>)}
        <span className="flex items-center gap-1.5"><i className="h-0 w-4 border-t border-dashed border-chart-cost" />成本</span>
      </div>
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
