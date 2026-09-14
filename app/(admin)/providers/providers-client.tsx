'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Check as CheckIcon, ChevronDown as ChevronIcon, Copy as CopyIcon, Eye as EyeIcon, EyeOff as EyeOffIcon, Plus, RefreshCw as RefreshIcon } from 'lucide-react';
import { getPreset } from '@/lib/presets';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { useToast } from '@/components/toast';
import { btn, cardCls } from '@/components/ui/styles';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ModelTable from './model-table';
import type { ModelItem } from './model-table';
import ProviderForm from './provider-form';
import type { ProviderFormState, ProviderView } from './provider-types';
import { createCustomFormEndpoints, protocolDisplayName, validateFormEndpoints } from '@/lib/services/provider-form';

const EMPTY_FORM: ProviderFormState = { id: null, preset_key: null, slug: '', name: '', api_key: '', remark: '', endpoints: createCustomFormEndpoints() };

function quotaTone(tiers?: { utilization: number }[]): string {
  if (!tiers?.length) return 'text-success';
  const highest = Math.max(...tiers.map((tier) => tier.utilization));
  if (highest >= 90) return 'text-destructive';
  if (highest >= 70) return 'text-warning';
  return 'text-success';
}

/** 厂商 logo；无 logo 或加载失败时用首字母占位图 */
function ProviderLogo({ presetKey, slug, name }: { presetKey: string | null; slug: string; name: string }) {
  const [err, setErr] = useState(false);
  const logo = getPreset(presetKey ?? slug)?.logo;
  if (!logo || err) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={logo} alt="" className="h-7 w-7 rounded object-contain" onError={() => setErr(true)} />;
}

/** 复制文本，clipboard API 失败时回退 execCommand */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 非 secure context 回退
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function ProvidersClient({ initialProviders }: { initialProviders: ProviderView[] }) {
  const [providers, setProviders] = useState<ProviderView[]>(initialProviders);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [form, setForm] = useState<ProviderFormState | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { confirm } = useConfirm();
  // 卡片头展示状态
  const [balances, setBalances] = useState<
    Record<string, { text: string; link?: string; error?: boolean; loading?: boolean; tiers?: { name: string; utilization: number; resets_at: string | null }[]; plan?: string }>
  >({});
  const [testResults, setTestResults] = useState<Record<string, { ms: number; ok: boolean; detail: string }>>({});
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [copiedKeys, setCopiedKeys] = useState<Record<string, boolean>>({});

  const notify = useCallback((text: string, error = false) => toast(text, error ? 'error' : 'success'), [toast]);

  const load = useCallback(async () => {
    const [pRes, mRes] = await Promise.all([fetch('/api/admin/providers'), fetch('/api/admin/models')]);
    if (pRes.ok) setProviders((await pRes.json()).providers);
    if (mRes.ok) setModels((await mRes.json()).models);
    setModelsLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- 余额：进入页面自动并发拉取 + 按 settings.balance_refresh_seconds 定时刷新 ----
  const refreshAllBalances = useCallback(async () => {
    const res = await fetch('/api/admin/balances');
    if (!res.ok) return;
    const data = await res.json();
    const next: typeof balances = {};
    for (const b of data.balances as any[]) {
      if (b.result.supported === false) {
        next[b.provider_id] = { text: '不支持', link: b.result.console_url };
      } else if (b.result.error && !b.result.tiers) {
        next[b.provider_id] = { text: '查询失败', error: true };
      } else {
        next[b.provider_id] = { text: b.result.summary, tiers: b.result.tiers, plan: b.result.plan };
      }
    }
    setBalances((prev) => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    (async () => {
      const s = await fetch('/api/admin/settings')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (disposed) return;
      await refreshAllBalances();
      const interval = Number(s?.balance_refresh_seconds ?? 60);
      if (interval > 0) {
        timer = setInterval(() => {
          if (!document.hidden) refreshAllBalances();
        }, interval * 1000);
      }
    })();
    // 回到前台立即刷一次
    const onVis = () => {
      if (!document.hidden) refreshAllBalances();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshAllBalances]);

  async function refreshBalance(p: ProviderView) {
    setBalances((b) => ({ ...b, [p.id]: { text: '查询中…', loading: true } }));
    const res = await fetch(`/api/admin/providers/${p.id}/balance`);
    const data = await res.json();
    if (!res.ok) setBalances((b) => ({ ...b, [p.id]: { text: data.error || '查询失败', error: true } }));
    else if (!data.supported) setBalances((b) => ({ ...b, [p.id]: { text: data.error || '不支持', link: data.console_url } }));
    else if (data.error && !data.tiers) setBalances((b) => ({ ...b, [p.id]: { text: '查询失败', error: true } }));
    else setBalances((b) => ({ ...b, [p.id]: { text: data.summary, tiers: data.tiers, plan: data.plan } }));
  }

  async function testProvider(p: ProviderView) {
    setTestResults((t) => ({ ...t, [p.id]: { ms: -1, ok: false, detail: '测速中…' } }));
    const res = await fetch(`/api/admin/providers/${p.id}/test`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) setTestResults((t) => ({ ...t, [p.id]: { ms: 0, ok: false, detail: data.error || '测速失败' } }));
    else
      setTestResults((t) => ({
        ...t,
        [p.id]: { ms: data.latency_ms, ok: !!data.ok, detail: data.ok ? `HTTP ${data.status}` : `HTTP ${data.status ?? ''} ${data.error ?? ''}` },
      }));
  }

  async function revealKey(p: ProviderView): Promise<string | null> {
    if (revealedKeys[p.id]) return revealedKeys[p.id];
    const res = await fetch(`/api/admin/providers/${p.id}/key`);
    if (!res.ok) return null;
    const data = await res.json();
    setRevealedKeys((k) => ({ ...k, [p.id]: data.api_key }));
    return data.api_key as string;
  }

  async function toggleRevealKey(p: ProviderView) {
    if (revealedKeys[p.id]) {
      setRevealedKeys((k) => {
        const next = { ...k };
        delete next[p.id];
        return next;
      });
      return;
    }
    await revealKey(p);
  }

  async function copyKey(p: ProviderView) {
    const key = await revealKey(p);
    if (!key) return;
    if (await copyText(key)) {
      setCopiedKeys((c) => ({ ...c, [p.id]: true }));
      setTimeout(() => setCopiedKeys((c) => ({ ...c, [p.id]: false })), 1500);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    let endpoints;
    try {
      endpoints = validateFormEndpoints(form.endpoints);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : '端点配置无效');
      return;
    }
    setSaving(true);
    try {
      const isEdit = form.id !== null;
      const defaultEndpoint = endpoints.find((endpoint) => endpoint.is_default);
      const payload: Record<string, unknown> = {
        name: form.name,
        remark: form.remark,
        endpoints,
        default_protocol: defaultEndpoint?.protocol,
      };
      if (form.preset_key) payload.preset_key = form.preset_key;
      if (form.api_key) payload.api_key = form.api_key;
      if (!isEdit) payload.slug = form.slug;
      const res = await fetch(isEdit ? `/api/admin/providers/${form.id}` : '/api/admin/providers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '保存失败');
        return;
      }
      setForm(null);
      await load();
      // 新建成功后自动同步模型并展开卡片
      if (!isEdit && data.provider?.id) {
        const pid = data.provider.id as string;
        setExpanded((ex) => ({ ...ex, [pid]: true }));
        notify(`已创建「${data.provider.name}」，正在同步模型…`);
        const syncRes = await fetch(`/api/admin/providers/${pid}/sync-models`, { method: 'POST' });
        const syncData = await syncRes.json();
        if (syncRes.ok) {
          notify(`模型同步完成：新增 ${syncData.added}，已存在 ${syncData.existing}`);
        } else {
          notify(`创建成功，但模型同步失败：${syncData.error || '未知错误'}`, true);
        }
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(p: ProviderView) {
    await fetch(`/api/admin/providers/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !p.enabled }),
    });
    await load();
  }

  async function onDelete(p: ProviderView) {
    const ok = await confirm({ title: `删除服务商「${p.name}」？`, description: '其下模型与关联配置将一并删除，操作不可恢复。', confirmText: '删除' });
    if (!ok) return;
    await fetch(`/api/admin/providers/${p.id}`, { method: 'DELETE' });
    notify(`已删除「${p.name}」`);
    await load();
  }

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button onClick={() => setForm({ ...EMPTY_FORM })}><Plus className="size-4" />新建服务商</Button>
      </div>

      <Sheet open={form !== null} onOpenChange={(open) => { if (!open) { setForm(null); setError(''); } }}>
        <SheetContent side="right" className="w-[min(96vw,48rem)] sm:max-w-none">
          <SheetHeader>
            <SheetTitle>{form?.id ? '编辑服务商' : '新建服务商'}</SheetTitle>
            <SheetDescription>{form?.id ? '更新凭据、端点和服务商信息。' : '选择预设并配置 API Key，模型将在创建后自动同步。'}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {form && <ProviderForm value={form} error={error} saving={saving} onChange={setForm} onSubmit={onSubmit} onCancel={() => { setForm(null); setError(''); }} embedded />}
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* 服务商卡片列表 */}
      <div className="space-y-3">
        {!modelsLoaded ? (
          <div className={cardCls}>
            <SkeletonRows rows={3} />
          </div>
        ) : providers.length === 0 ? (
          <div className={cardCls}>
            <EmptyState
              title="还没有服务商"
              description="添加你的第一个模型服务商，网关即刻可用"
              actionLabel="新建服务商"
              onAction={() => setForm({ ...EMPTY_FORM })}
            />
          </div>
        ) : (
          providers.map((p) => {
            const bal = balances[p.id];
            const test = testResults[p.id];
            const isOpen = !!expanded[p.id];
            const detailsId = `provider-details-${p.id}`;
            return (
              <div key={p.id} className={`overflow-hidden ${cardCls}`}>
                <div className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                  <ProviderLogo presetKey={p.preset_key} slug={p.slug} name={p.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium tracking-[-0.01em]">{p.name}</span>{p.auth_kind==='subscription' && <Link href="/subscriptions" className="text-xs text-primary">订阅账号</Link>}
                      <span className="text-xs text-muted-foreground">{p.endpoints.length} 种接入格式 · 默认 {protocolDisplayName(p.default_protocol)}</span>
                    </div>
                    <div className="truncate text-xs text-subtle-foreground" title={p.base_url}>
                      {p.slug} · {p.base_url}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-[11px] sm:hidden">
                      <span className={bal?.error ? 'text-destructive' : bal ? quotaTone(bal.tiers) : 'text-subtle-foreground'}>
                        {bal?.loading ? '查询中…' : bal?.error ? '余额查询失败' : bal?.text ?? '—'}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                        <span className={`h-1.5 w-1.5 rounded-full ${p.enabled ? 'bg-success' : 'bg-subtle-foreground'}`} aria-hidden="true" />
                        {p.enabled ? '已启用' : '已停用'}
                      </span>
                    </div>
                  </div>

                  <div className="ml-auto hidden min-w-0 text-right sm:block">
                    {bal?.loading ? (
                      <span className="text-xs text-subtle-foreground">查询中…</span>
                    ) : bal?.error ? (
                      <span className="text-xs text-destructive" title={bal.text}>余额查询失败</span>
                    ) : bal ? (
                      <span className={`text-xs font-medium ${quotaTone(bal.tiers)}`}>{bal.text}</span>
                    ) : (
                      <span className="text-xs text-subtle-foreground">—</span>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
                      <span className={`h-1.5 w-1.5 rounded-full ${p.enabled ? 'bg-success' : 'bg-subtle-foreground'}`} aria-hidden="true" />
                      {p.enabled ? '已启用' : '已停用'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpand(p.id)}
                    aria-expanded={isOpen}
                    aria-controls={detailsId}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-10 sm:w-10"
                    title={isOpen ? '收起详情' : '展开详情'}
                  >
                    <ChevronIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {isOpen && (
                  <Tabs id={detailsId} defaultValue="overview" className="border-t border-border">
                    <div className="border-b border-border px-4 pt-3 sm:px-5">
                      <TabsList aria-label={`${p.name}详情`}>
                        <TabsTrigger value="overview">概览</TabsTrigger>
                        <TabsTrigger value="endpoints">端点</TabsTrigger>
                        <TabsTrigger value="models">模型</TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="overview" className="mt-0">
                    <div className="grid gap-5 bg-muted/35 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">余额 / 套餐</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            {bal?.loading ? (
                              <span className="text-subtle-foreground">查询中…</span>
                            ) : bal?.error ? (
                              <span className="text-destructive" title={bal.text}>查询失败</span>
                            ) : (
                              <span className={`font-medium ${quotaTone(bal?.tiers)}`}>{bal?.text ?? '—'}</span>
                            )}
                            {bal?.link && (
                              <a href={bal.link} target="_blank" rel="noreferrer" className={btn.link}>控制台</a>
                            )}
                            {p.auth_kind!=='subscription' && <button onClick={() => refreshBalance(p)} aria-label="立即刷新余额" className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground sm:h-8 sm:w-8" title="立即刷新余额">
                              <RefreshIcon className="h-3.5 w-3.5" />
                            </button>}
                          </div>
                        </div>
                        {p.has_key && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">API Key</div>
                            <div className="mt-2 flex max-w-sm items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
                              <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={revealedKeys[p.id] ?? ''}>
                                {revealedKeys[p.id] ?? '••••••••'}
                              </code>
                              <button onClick={() => toggleRevealKey(p)} className="flex h-11 w-11 items-center justify-center rounded-md text-subtle-foreground hover:bg-muted hover:text-foreground sm:h-10 sm:w-10" title={revealedKeys[p.id] ? '隐藏明文' : '查看明文'}>
                                {revealedKeys[p.id] ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                              </button>
                              <button onClick={() => copyKey(p)} className="flex h-11 w-11 items-center justify-center rounded-md text-subtle-foreground hover:bg-muted hover:text-foreground sm:h-10 sm:w-10" title="复制 Key">
                                {copiedKeys[p.id] ? <CheckIcon className="h-4 w-4 text-success" /> : <CopyIcon className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <div className="mr-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch checked={p.enabled} onCheckedChange={() => toggleEnabled(p)} aria-label={p.enabled ? '禁用服务商' : '启用服务商'} />
                          {p.enabled ? '已启用' : '已停用'}
                        </div>
                        {p.auth_kind==='subscription'?<Link href="/subscriptions" className={btn.ghost}>管理订阅账号</Link>:<><button onClick={() => testProvider(p)} className={btn.ghost}>
                          {test && test.ms < 0 ? '测速中…' : '测速'}
                        </button>
                        <button
                          onClick={() => setForm({
                            id: p.id,
                            preset_key: p.preset_key,
                            slug: p.slug,
                            name: p.name,
                            api_key: '',
                            remark: p.remark ?? '',
                            endpoints: p.endpoints.map((endpoint) => ({
                              protocol: endpoint.protocol,
                              base_url: endpoint.base_url,
                              enabled: endpoint.enabled,
                              is_default: endpoint.is_default,
                            })),
                          })}
                          className={btn.ghost}
                        >
                          编辑
                        </button>
                        <button onClick={() => onDelete(p)} className={btn.danger}>删除</button></>}
                        {test && test.ms >= 0 && (
                          <span className={`text-xs ${test.ok ? 'text-success' : 'text-destructive'}`} title={test.detail}>
                            <span className="tabular-nums">{test.ms}</span>ms
                          </span>
                        )}
                      </div>
                    </div>

                    {bal?.tiers && bal.tiers.length > 0 && (
                      <div className="border-t border-border px-4 py-5 sm:px-5">
                        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">套餐额度 · 已用</span>
                          {bal.plan && <span>{bal.plan}</span>}
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          {bal.tiers.map((t) => {
                            const pct = Math.min(100, Math.max(0, t.utilization));
                            const label = t.name === 'five_hour' ? '5小时' : t.name === 'weekly_limit' ? '7天' : t.name;
                            return (
                              <div key={t.name}>
                                <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                                  <span className="font-medium text-muted-foreground">{label}</span>
                                  <span className={pct >= 90 ? 'text-destructive' : pct >= 70 ? 'text-warning' : 'text-foreground'}>{Math.round(pct)}%</span>
                                </div>
                                <Progress
                                  value={pct}
                                  aria-label={`${label}已用额度`}
                                  indicatorClassName={pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-primary'}
                                />
                                {t.resets_at && <div className="mt-2 text-[11px] text-subtle-foreground">重置于 {new Date(t.resets_at).toLocaleString('zh-CN')}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    </TabsContent>
                    <TabsContent value="endpoints" className="mt-0">
                    <div className="px-4 py-5 sm:px-5">
                      <div className="text-xs font-medium text-muted-foreground">接入端点</div>
                      <div className="minimal-scrollbar mt-3 overflow-x-auto">
                        <table className="min-w-[34rem] w-full text-left text-xs">
                          <thead className="text-subtle-foreground"><tr><th className="pb-2 font-medium">协议</th><th className="pb-2 font-medium">Base URL</th><th className="pb-2 text-right font-medium">状态</th></tr></thead>
                          <tbody className="divide-y divide-border">
                            {p.endpoints.map((endpoint) => (
                              <tr key={endpoint.protocol}><td className="py-2 text-muted-foreground">{protocolDisplayName(endpoint.protocol)}{endpoint.is_default && <span className="ml-2 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] text-primary">默认</span>}</td><td className="py-2 font-mono text-subtle-foreground">{endpoint.base_url}</td><td className="py-2 text-right">{endpoint.enabled ? <span className="text-success">启用</span> : <span className="text-subtle-foreground">停用</span>}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    </TabsContent>
                    <TabsContent value="models" className="mt-0">
                      <ModelTable subscription={p.auth_kind==='subscription'} providerId={p.id} models={models.filter((m) => m.provider_id === p.id)} onChanged={load} onToast={notify} />
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
