'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Eye, EyeOff, KeyRound, Plus } from 'lucide-react';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { useToast } from '@/components/toast';
import { btn, tableHeadCls, tableWrapCls } from '@/components/ui/styles';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

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
      <Dialog open={newKey !== null} onOpenChange={(open) => { if (!open) setNewKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="size-5 text-success" />令牌创建成功</DialogTitle>
            <DialogDescription>这是唯一一次显示完整密钥。关闭前请复制并保存到安全位置。</DialogDescription>
          </DialogHeader>
          {newKey && <div className="rounded-lg border border-success/25 bg-success-soft p-3" role="status">
            <code className="block break-all text-xs leading-6">{newKey}</code>
          </div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewKey(null)}>我已保存</Button>
            <Button
              type="button"
              onClick={async () => {
                if (newKey && await copyText(newKey)) {
                  setNewKeyCopied(true);
                  setTimeout(() => setNewKeyCopied(false), 1500);
                }
              }}
            >
              {newKeyCopied ? <Check className="size-4" /> : <Copy className="size-4" />}{newKeyCopied ? '已复制' : '复制密钥'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-5 flex justify-end">
        <Button onClick={() => setShowForm(true)}><Plus className="size-4" />新建令牌</Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建网关令牌</DialogTitle><DialogDescription>为客户端创建独立凭据，可选设置有效期与消费限额。</DialogDescription></DialogHeader>
          <form onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="token-name">名称</Label>
              <Input id="token-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Claude Code 本机"
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="token-expiry">过期天数</Label>
              <Input id="token-expiry"
                type="number"
                min={1}
                value={form.expires_days}
                onChange={(e) => setForm({ ...form, expires_days: e.target.value })}
                placeholder="永不过期"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="token-limit">花费限额（$）</Label>
              <Input id="token-limit"
                type="number"
                min={0}
                step="0.01"
                value={form.spend_limit}
                onChange={(e) => setForm({ ...form, spend_limit: e.target.value })}
                placeholder="不限"
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>限额窗口</Label>
              <Select
                value={form.spend_window}
                onValueChange={(spend_window) => setForm({ ...form, spend_window })}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="day">当天</SelectItem><SelectItem value="week">近 7 天</SelectItem><SelectItem value="month">近 30 天</SelectItem><SelectItem value="total">累计</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>取消</Button><Button type="submit">创建令牌</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                          {revealed[t.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => copyKey(t)} className="flex h-8 w-8 items-center justify-center rounded-md text-subtle-foreground hover:bg-muted hover:text-foreground" title="复制" aria-label={`复制${t.name}令牌`}>
                          {copied[t.id] ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
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
                          <Progress value={pct ?? 0} aria-label={`${t.name}花费限额已用`} indicatorClassName={pct != null && pct >= 100 ? 'bg-destructive' : 'bg-primary'} />
                        </div>
                      ) : (
                        <span className="text-xs text-subtle-foreground">不限</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {t.expires_at ? new Date(t.expires_at).toLocaleString('zh-CN') : '永不'}
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked={t.enabled} onCheckedChange={() => toggleEnabled(t)} aria-label={t.enabled ? '禁用' : '启用'} />
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
