'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { btn, cardCls, inputCls, tableHeadCls, tableWrapCls, toggleCls, toggleKnobCls } from '@/components/ui';

interface Token {
  id: string;
  name: string;
  prefix: string;
  enabled: boolean;
  expires_at: number | null;
  spend_limit: number | null;
  spend_window: 'day' | 'week' | 'month' | 'total' | null;
  spent: number | null;
  created_at: number | null;
}

const WINDOW_LABELS: Record<string, string> = { day: '当天', week: '近 7 天', month: '近 30 天', total: '累计' };

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 回退
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

export default function TokensClient() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', expires_days: '', spend_limit: '', spend_window: 'total' });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [newKeyCopied, setNewKeyCopied] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const { confirm } = useConfirm();
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/tokens');
    if (res.ok) setTokens((await res.json()).tokens);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const body: Record<string, unknown> = { name: form.name };
    if (form.expires_days.trim()) {
      const days = Number(form.expires_days);
      if (!Number.isFinite(days) || days <= 0) {
        setError('过期天数必须是正数');
        return;
      }
      body.expires_at = Date.now() + days * 86_400_000;
    }
    if (form.spend_limit.trim()) {
      body.spend_limit = Number(form.spend_limit);
      body.spend_window = form.spend_window;
    }
    const res = await fetch('/api/admin/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || '创建失败');
      return;
    }
    setNewKey(data.key);
    setNewKeyCopied(false);
    setShowForm(false);
    setForm({ name: '', expires_days: '', spend_limit: '', spend_window: 'total' });
    await load();
  }

  async function toggleEnabled(t: Token) {
    await fetch(`/api/admin/tokens/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !t.enabled }),
    });
    await load();
  }

  async function onDelete(t: Token) {
    const ok = await confirm({
      title: `删除令牌「${t.name}」？`,
      description: '使用该令牌的客户端将立即失效，操作不可恢复。',
      confirmText: '删除',
    });
    if (!ok) return;
    await fetch(`/api/admin/tokens/${t.id}`, { method: 'DELETE' });
    toast(`已删除令牌「${t.name}」`);
    await load();
  }

  async function toggleReveal(t: Token) {
    if (revealed[t.id]) {
      setRevealed((r) => {
        const next = { ...r };
        delete next[t.id];
        return next;
      });
      return;
    }
    const res = await fetch(`/api/admin/tokens/${t.id}/key`);
    if (res.ok) {
      const data = await res.json();
      setRevealed((r) => ({ ...r, [t.id]: data.key }));
    }
  }

  async function copyKey(t: Token) {
    let key = revealed[t.id];
    if (!key) {
      const res = await fetch(`/api/admin/tokens/${t.id}/key`);
      if (!res.ok) return;
      key = (await res.json()).key;
    }
    if (await copyText(key)) {
      setCopied((c) => ({ ...c, [t.id]: true }));
      setTimeout(() => setCopied((c) => ({ ...c, [t.id]: false })), 1500);
    }
  }

  return (
    <div>
      {newKey && (
        <div className="mb-6 rounded-lg border border-success/25 bg-success-soft px-4 py-4 text-sm" role="status">
          <div className="mb-2 font-medium text-success">新令牌已创建，请立即保存</div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-success/20 bg-surface px-3 py-2 text-xs">{newKey}</code>
            <button
              type="button"
              onClick={async () => {
                if (await copyText(newKey)) {
                  setNewKeyCopied(true);
                  setTimeout(() => setNewKeyCopied(false), 1500);
                }
              }}
              className={btn.ghost}
            >
              {newKeyCopied ? '已复制' : '复制'}
            </button>
            <button type="button" onClick={() => setNewKey(null)} className={btn.link}>
              关闭
            </button>
          </div>
        </div>
      )}

      <div className="mb-5 flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className={btn.primary}
        >
          + 新建令牌
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className={`mb-6 ${cardCls} p-5 sm:p-6`}>
          <h2 className="mb-5 text-base font-semibold tracking-[-0.02em]">新建令牌</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_160px_140px_160px_auto] lg:items-end">
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted-foreground">名称</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Claude Code 本机"
                className={`w-full ${inputCls}`}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted-foreground">过期天数</span>
              <input
                type="number"
                min={1}
                value={form.expires_days}
                onChange={(e) => setForm({ ...form, expires_days: e.target.value })}
                placeholder="永不过期"
                className={`w-full ${inputCls}`}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted-foreground">花费限额（$）</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.spend_limit}
                onChange={(e) => setForm({ ...form, spend_limit: e.target.value })}
                placeholder="不限"
                className={`w-full ${inputCls}`}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted-foreground">限额窗口</span>
              <select
                value={form.spend_window}
                onChange={(e) => setForm({ ...form, spend_window: e.target.value })}
                className={`w-full ${inputCls}`}
              >
                <option value="day">当天</option>
                <option value="week">近 7 天</option>
                <option value="month">近 30 天</option>
                <option value="total">累计</option>
              </select>
            </label>
            <button type="submit" className={btn.primary}>
              创建
            </button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </form>
      )}

      <div className={tableWrapCls}>
        <table className="min-w-[900px] w-full text-sm">
          <thead className={tableHeadCls}>
            <tr>
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">限额 / 已用</th>
              <th className="px-4 py-3 font-medium">过期时间</th>
              <th className="px-4 py-3 font-medium">启用</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
                <tr><td colSpan={6}><SkeletonRows rows={2} /></td></tr>
              ) : tokens.length === 0 ? (
                <tr><td colSpan={6}><EmptyState title="暂无令牌" description="创建一个令牌供客户端调用网关" /></td></tr>
              ) : (
              tokens.map((t) => {
                const expired = t.expires_at != null && t.expires_at < Date.now();
                const pct = t.spend_limit != null && t.spent != null ? Math.min(100, (t.spent / t.spend_limit) * 100) : null;
                return (
                  <tr key={t.id} className={`transition-colors hover:bg-muted/35 ${t.enabled && !expired ? '' : 'opacity-55'}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-subtle-foreground">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('zh-CN') : ''} 创建
                        {expired && <span className="ml-1 text-destructive">已过期</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex w-52 items-center gap-1">
                        <code className="flex-1 truncate text-xs text-muted-foreground" title={revealed[t.id] ?? ''}>
                          {revealed[t.id] ?? `${t.prefix}…`}
                        </code>
                        <button type="button" onClick={() => toggleReveal(t)} className="flex h-8 w-8 items-center justify-center rounded-md text-subtle-foreground hover:bg-muted hover:text-foreground" title={revealed[t.id] ? '隐藏' : '查看明文'} aria-label={revealed[t.id] ? `隐藏${t.name}令牌` : `查看${t.name}令牌明文`}>
                          {revealed[t.id] ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => copyKey(t)} className="flex h-8 w-8 items-center justify-center rounded-md text-subtle-foreground hover:bg-muted hover:text-foreground" title="复制" aria-label={`复制${t.name}令牌`}>
                          {copied[t.id] ? <CheckIcon className="h-3.5 w-3.5 text-success" /> : <CopyIcon className="h-3.5 w-3.5" />}
                        </button>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.spend_limit != null ? (
                        <div className="w-40">
                          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                            <span className="tabular-nums">${(t.spent ?? 0).toFixed(4)} / ${t.spend_limit}</span>
                            <span className="text-subtle-foreground">{WINDOW_LABELS[t.spend_window ?? 'total']}</span>
                          </div>
                          <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-label={`${t.name}花费限额已用`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(pct ?? 0)}
                          >
                            <div
                              className={`h-full rounded-full ${pct != null && pct >= 100 ? 'bg-destructive' : 'bg-primary'}`}
                              style={{ width: `${pct ?? 0}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-subtle-foreground">不限</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {t.expires_at ? new Date(t.expires_at).toLocaleString('zh-CN') : '永不'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleEnabled(t)}
                        className={toggleCls(t.enabled)}
                        aria-label={t.enabled ? '禁用' : '启用'}
                      >
                        <span
                          className={toggleKnobCls(t.enabled)}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <Link href={`/?token=${encodeURIComponent(t.id)}&range=30d`} className={btn.link}>查看用量</Link>
                        <button onClick={() => onDelete(t)} className={btn.linkDanger}>删除</button>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
