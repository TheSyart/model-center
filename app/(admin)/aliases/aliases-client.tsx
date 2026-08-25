'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { btn, tableHeadCls, tableWrapCls } from '@/components/ui/styles';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

interface Provider {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
}

interface Model {
  id: string;
  provider_id: string;
  model_id: string;
  enabled: boolean;
}

interface AliasItem {
  id: string;
  alias: string;
  targets: { provider_id: string; model_id: string }[];
  enabled: boolean;
}

interface TargetDraft {
  provider_id: string;
  model_id: string;
}

interface FormState {
  id: string | null;
  alias: string;
  targets: TargetDraft[];
}

export default function AliasesClient() {
  const [aliases, setAliases] = useState<AliasItem[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { confirm } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, pRes, mRes] = await Promise.all([
      fetch('/api/admin/aliases'),
      fetch('/api/admin/providers'),
      fetch('/api/admin/models'),
    ]);
    if (aRes.ok) setAliases((await aRes.json()).aliases);
    if (pRes.ok) setProviders((await pRes.json()).providers);
    if (mRes.ok) setModels((await mRes.json()).models);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const providerName = (id: string) => providers.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  function openForm(a?: AliasItem) {
    setError('');
    setForm(a ? { id: a.id, alias: a.alias, targets: a.targets.map((t) => ({ ...t })) } : { id: null, alias: '', targets: [] });
  }

  function updateTarget(i: number, patch: Partial<TargetDraft>) {
    if (!form) return;
    const targets = form.targets.map((t, j) => (j === i ? { ...t, ...patch } : t));
    setForm({ ...form, targets });
  }

  function moveTarget(i: number, dir: -1 | 1) {
    if (!form) return;
    const j = i + dir;
    if (j < 0 || j >= form.targets.length) return;
    const targets = [...form.targets];
    [targets[i], targets[j]] = [targets[j], targets[i]];
    setForm({ ...form, targets });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    setSaving(true);
    try {
      const isEdit = form.id !== null;
      const res = await fetch(isEdit ? `/api/admin/aliases/${form.id}` : '/api/admin/aliases', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: form.alias, targets: form.targets.filter((t) => t.provider_id && t.model_id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '保存失败');
        return;
      }
      setForm(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(a: AliasItem) {
    await fetch(`/api/admin/aliases/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    await load();
  }

  async function onDelete(a: AliasItem) {
    if (!(await confirm({ title: `删除别名「${a.alias}」？`, confirmText: '删除' }))) return;
    await fetch(`/api/admin/aliases/${a.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button onClick={() => openForm()}><Plus className="size-4" />新建别名</Button>
      </div>

      <Sheet open={form !== null} onOpenChange={(open) => { if (!open) setForm(null); }}>
        <SheetContent className="w-[min(96vw,46rem)] sm:max-w-none">
          <SheetHeader>
            <SheetTitle>{form?.id ? '编辑别名' : '新建别名'}</SheetTitle>
            <SheetDescription>目标按从上到下的顺序依次尝试，上一项不可用时自动降级。</SheetDescription>
          </SheetHeader>
          {form && <form id="alias-form" onSubmit={onSubmit} className="contents">
          <SheetBody>
          <label className="mb-5 block">
            <span className="mb-1.5 block text-sm text-muted-foreground">别名（全局唯一）</span>
            <Input
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
              placeholder="best-coding"
              required
            />
          </label>
          <div className="mb-2 text-sm font-medium">Failover 顺序</div>
          <div className="space-y-3">
            {form.targets.map((t, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/25 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">优先级 {i + 1}</span>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => moveTarget(i, -1)} aria-label={`上移第 ${i + 1} 个目标`}><ArrowUp className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" disabled={i === form.targets.length - 1} onClick={() => moveTarget(i, 1)} aria-label={`下移第 ${i + 1} 个目标`}><ArrowDown className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, targets: form.targets.filter((_, j) => j !== i) })} aria-label={`移除第 ${i + 1} 个目标`}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                <Combobox
                  value={t.provider_id}
                  onValueChange={(provider_id) => updateTarget(i, { provider_id, model_id: '' })}
                  options={providers.map((p) => ({ value: p.id, label: p.name, keywords: p.slug }))}
                  placeholder="选择服务商…"
                  searchPlaceholder="搜索服务商…"
                  aria-label={`第 ${i + 1} 个目标的服务商`}
                />
                <Combobox
                  value={t.model_id}
                  onValueChange={(model_id) => updateTarget(i, { model_id })}
                  options={models.filter((m) => m.provider_id === t.provider_id).map((m) => ({ value: m.model_id, label: m.model_id }))}
                  placeholder="选择模型…"
                  searchPlaceholder="搜索模型…"
                  aria-label={`第 ${i + 1} 个目标的模型`}
                  disabled={!t.provider_id}
                />
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            onClick={() => setForm({ ...form, targets: [...form.targets, { provider_id: '', model_id: '' }] })}
            variant="outline"
            className="mt-3 w-full border-dashed"
          >
            <Plus className="size-4" />添加目标
          </Button>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setForm(null)}>取消</Button>
            <Button type="submit" disabled={saving || form.targets.filter((t) => t.provider_id && t.model_id).length === 0}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </SheetFooter>
          </form>}
        </SheetContent>
      </Sheet>

      <div className={tableWrapCls}>
        <table className="min-w-[760px] w-full text-sm">
          <thead className={tableHeadCls}>
            <tr>
              <th className="px-4 py-3 font-medium">别名</th>
              <th className="px-4 py-3 font-medium">目标（按降级顺序）</th>
              <th className="px-4 py-3 font-medium">启用</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={4}>
                  <SkeletonRows rows={2} />
                </td>
              </tr>
            ) : aliases.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    title="还没有别名"
                    description="别名为虚拟模型名，多个目标按顺序构成 failover 降级链"
                    actionLabel="新建别名"
                    onAction={() => openForm()}
                  />
                </td>
              </tr>
            ) : (
              aliases.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-muted/35">
                  <td className="px-4 py-3 font-mono text-sm font-medium">{a.alias}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {a.targets.map((t, i) => (
                        <span key={i} className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {i + 1}. {providerName(t.provider_id)}/{t.model_id}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Switch checked={a.enabled} onCheckedChange={() => toggleEnabled(a)} aria-label={a.enabled ? '禁用' : '启用'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => openForm(a)} className={btn.link}>
                        编辑
                      </button>
                      <button onClick={() => onDelete(a)} className={btn.linkDanger}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
