'use client';

import { useCallback, useEffect, useState } from 'react';
import { getPreset, presetDisplayName, presetsByCategory } from '@/lib/presets';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { CheckIcon, ChevronIcon, CopyIcon, EyeIcon, EyeOffIcon, RefreshIcon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { btn, cardCls, inputCls, toggleCls, toggleKnobCls } from '@/components/ui';
import ModelTable from './model-table';
import type { ModelItem } from './model-table';

interface Provider {
  id: string;
  slug: string;
  name: string;
  protocol: string;
  base_url: string;
  enabled: boolean;
  priority: number;
  remark: string | null;
  has_key: boolean;
}

interface FormState {
  id: string | null; // null = 新建
  slug: string;
  name: string;
  protocol: string;
  base_url: string;
  api_key: string;
  remark: string;
}

const EMPTY_FORM: FormState = { id: null, slug: '', name: '', protocol: 'openai', base_url: '', api_key: '', remark: '' };

function quotaTone(tiers?: { utilization: number }[]): string {
  if (!tiers?.length) return 'text-success';
  const highest = Math.max(...tiers.map((tier) => tier.utilization));
  if (highest >= 90) return 'text-destructive';
  if (highest >= 70) return 'text-warning';
  return 'text-success';
}

/** 厂商 logo；无 logo 或加载失败时用首字母占位图 */
function ProviderLogo({ slug, name }: { slug: string; name: string }) {
  const [err, setErr] = useState(false);
  const logo = getPreset(slug)?.logo;
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

export default function ProvidersClient({ initialProviders }: { initialProviders: Provider[] }) {
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
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
  const [showKeyInput, setShowKeyInput] = useState(false);

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

  async function refreshBalance(p: Provider) {
    setBalances((b) => ({ ...b, [p.id]: { text: '查询中…', loading: true } }));
    const res = await fetch(`/api/admin/providers/${p.id}/balance`);
    const data = await res.json();
    if (!res.ok) setBalances((b) => ({ ...b, [p.id]: { text: data.error || '查询失败', error: true } }));
    else if (!data.supported) setBalances((b) => ({ ...b, [p.id]: { text: data.error || '不支持', link: data.console_url } }));
    else if (data.error && !data.tiers) setBalances((b) => ({ ...b, [p.id]: { text: '查询失败', error: true } }));
    else setBalances((b) => ({ ...b, [p.id]: { text: data.summary, tiers: data.tiers, plan: data.plan } }));
  }

  async function testProvider(p: Provider) {
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

  async function revealKey(p: Provider): Promise<string | null> {
    if (revealedKeys[p.id]) return revealedKeys[p.id];
    const res = await fetch(`/api/admin/providers/${p.id}/key`);
    if (!res.ok) return null;
    const data = await res.json();
    setRevealedKeys((k) => ({ ...k, [p.id]: data.api_key }));
    return data.api_key as string;
  }

  async function toggleRevealKey(p: Provider) {
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

  async function copyKey(p: Provider) {
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

  function onSelectPreset(slug: string) {
    const preset = getPreset(slug);
    if (!preset || !form) return;
    setForm({ ...form, slug: preset.slug, name: preset.name, protocol: preset.protocol, base_url: preset.baseUrl });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    setSaving(true);
    try {
      const isEdit = form.id !== null;
      const payload: Record<string, unknown> = { name: form.name, protocol: form.protocol, base_url: form.base_url, remark: form.remark };
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

  async function toggleEnabled(p: Provider) {
    await fetch(`/api/admin/providers/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !p.enabled }),
    });
    await load();
  }

  async function onDelete(p: Provider) {
    const ok = await confirm({ title: `删除服务商「${p.name}」？`, description: '其下模型与关联配置将一并删除，操作不可恢复。', confirmText: '删除' });
    if (!ok) return;
    await fetch(`/api/admin/providers/${p.id}`, { method: 'DELETE' });
    notify(`已删除「${p.name}」`);
    await load();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setForm({ ...EMPTY_FORM })} className={btn.primary}>
          + 新建服务商
        </button>
      </div>

      {form && (
        <form onSubmit={onSubmit} className={`mb-6 ${cardCls} p-6`}>
          <h2 className="mb-4 text-lg font-medium">{form.id ? '编辑服务商' : '新建服务商'}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {!form.id && (
              <div className="block">
                <span className="mb-1.5 block text-sm font-medium text-muted-foreground">从预设选择</span>
                <div className="flex items-center gap-2">
                  {getPreset(form.slug)?.logo && <img src={getPreset(form.slug)!.logo} alt="" className="h-6 w-6 rounded object-contain" />}
                  <select
                    aria-label="服务商预设"
                    defaultValue=""
                    onChange={(e) => onSelectPreset(e.target.value)}
                    className={`w-full ${inputCls}`}
                  >
                    <option value="" disabled>
                      选择预设…
                    </option>
                    {presetsByCategory().map((g) => (
                      <optgroup key={g.category} label={g.label}>
                        {g.presets.map((p) => (
                          <option key={p.slug} value={p.slug} disabled={p.supported === false}>
                            {presetDisplayName(p)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Slug（唯一标识）</span>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                disabled={form.id !== null}
                placeholder="deepseek"
                className={`w-full ${inputCls}`}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">名称</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`w-full ${inputCls}`}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">协议</span>
              <select
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                className={`w-full ${inputCls}`}
              >
                <option value="openai">OpenAI Chat 兼容</option>
                <option value="openai-responses">OpenAI Responses</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Base URL（须 https）</span>
              <input
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                className={`w-full ${inputCls}`}
                required
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">
                API Key{form.id ? '（留空则不修改，加密存储，永不回显）' : '（加密存储）'}
              </span>
              <div className="relative">
                <input
                  type={showKeyInput ? 'text' : 'password'}
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder={form.id ? '留空则不修改' : 'sk-...'}
                  className={`w-full ${inputCls} pr-10`}
                  required={form.id === null}
                />
                <button
                  type="button"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={showKeyInput ? '隐藏' : '显示'}
                  aria-label={showKeyInput ? '隐藏 API Key' : '显示 API Key'}
                >
                  {showKeyInput ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">备注</span>
              <input
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                className={`w-full ${inputCls}`}
              />
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className={btn.primary}>
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(null);
                setError('');
              }}
              className={btn.ghost}
            >
              取消
            </button>
          </div>
        </form>
      )}

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
                  <ProviderLogo slug={p.slug} name={p.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium tracking-[-0.01em]">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.protocol}</span>
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
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={isOpen ? '收起详情' : '展开详情'}
                  >
                    <ChevronIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {isOpen && (
                  <div id={detailsId} className="border-t border-border">
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
                            <button onClick={() => refreshBalance(p)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground" title="立即刷新余额">
                              <RefreshIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {p.has_key && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">API Key</div>
                            <div className="mt-2 flex max-w-sm items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
                              <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={revealedKeys[p.id] ?? ''}>
                                {revealedKeys[p.id] ?? '••••••••'}
                              </code>
                              <button onClick={() => toggleRevealKey(p)} className="text-subtle-foreground hover:text-foreground" title={revealedKeys[p.id] ? '隐藏明文' : '查看明文'}>
                                {revealedKeys[p.id] ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                              </button>
                              <button onClick={() => copyKey(p)} className="text-subtle-foreground hover:text-foreground" title="复制 Key">
                                {copiedKeys[p.id] ? <CheckIcon className="h-4 w-4 text-success" /> : <CopyIcon className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <div className="mr-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <button type="button" onClick={() => toggleEnabled(p)} className={toggleCls(p.enabled)} aria-label={p.enabled ? '禁用服务商' : '启用服务商'}>
                            <span className={toggleKnobCls(p.enabled)} />
                          </button>
                          {p.enabled ? '已启用' : '已停用'}
                        </div>
                        <button onClick={() => testProvider(p)} className={btn.ghost}>
                          {test && test.ms < 0 ? '测速中…' : '测速'}
                        </button>
                        <button
                          onClick={() => setForm({ id: p.id, slug: p.slug, name: p.name, protocol: p.protocol, base_url: p.base_url, api_key: '', remark: p.remark ?? '' })}
                          className={btn.ghost}
                        >
                          编辑
                        </button>
                        <button onClick={() => onDelete(p)} className={btn.danger}>删除</button>
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
                                <div
                                  role="progressbar"
                                  aria-label={`${label}已用额度`}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={Math.round(pct)}
                                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                                >
                                  <div
                                    className={`h-full rounded-full ${pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-primary'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                {t.resets_at && <div className="mt-2 text-[11px] text-subtle-foreground">重置于 {new Date(t.resets_at).toLocaleString('zh-CN')}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <ModelTable providerId={p.id} models={models.filter((m) => m.provider_id === p.id)} onChanged={load} onToast={notify} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
