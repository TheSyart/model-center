'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { btn, cardCls, inputCls, tableHeadCls, tableWrapCls, toggleCls, toggleKnobCls } from '@/components/ui';

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
        <button
          onClick={() => openForm()}
          className={btn.primary}
        >
          + 新建别名
        </button>
      </div>

      {form && (
        <form onSubmit={onSubmit} className={`mb-6 ${cardCls} p-5 sm:p-6`}>
          <h2 className="mb-5 text-base font-semibold tracking-[-0.02em]">{form.id ? '编辑别名' : '新建别名'}</h2>
          <label className="mb-4 block max-w-sm">
            <span className="mb-1.5 block text-sm text-muted-foreground">别名（全局唯一）</span>
            <input
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
              placeholder="best-coding"
              className={`w-full ${inputCls}`}
              required
            />
          </label>
          <div className="mb-2 text-sm text-muted-foreground">目标列表（按顺序降级）</div>
          <div className="space-y-2">
            {form.targets.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-center text-xs text-subtle-foreground">{i + 1}</span>
                <select
                  value={t.provider_id}
                  onChange={(e) => updateTarget(i, { provider_id: e.target.value, model_id: '' })}
                  className={inputCls}
                  required
                >
                  <option value="" disabled>
                    服务商…
                  </option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={t.model_id}
                  onChange={(e) => updateTarget(i, { model_id: e.target.value })}
                  className={inputCls}
                  required
                >
                  <option value="" disabled>
                    模型…
                  </option>
                  {models
                    .filter((m) => m.provider_id === t.provider_id)
                    .map((m) => (
                      <option key={m.id} value={m.model_id}>
                        {m.model_id}
                      </option>
                    ))}
                </select>
                <button type="button" onClick={() => moveTarget(i, -1)} className="px-1 text-subtle-foreground hover:text-foreground" title="上移" aria-label={`上移第 ${i + 1} 个目标`}>
                  ↑
                </button>
                <button type="button" onClick={() => moveTarget(i, 1)} className="px-1 text-subtle-foreground hover:text-foreground" title="下移" aria-label={`下移第 ${i + 1} 个目标`}>
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, targets: form.targets.filter((_, j) => j !== i) })}
                  className="px-1 text-destructive hover:opacity-70"
                  title="移除"
                  aria-label={`移除第 ${i + 1} 个目标`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, targets: [...form.targets, { provider_id: '', model_id: '' }] })}
            className="mt-3 min-h-10 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            + 添加目标
          </button>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving || form.targets.filter((t) => t.provider_id && t.model_id).length === 0}
              className={btn.primary}
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className={btn.ghost}
            >
              取消
            </button>
          </div>
        </form>
      )}

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
                    <button onClick={() => toggleEnabled(a)} className={toggleCls(a.enabled)} aria-label={a.enabled ? '禁用' : '启用'}>
                      <span className={toggleKnobCls(a.enabled)} />
                    </button>
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
