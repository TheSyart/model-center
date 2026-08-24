'use client';

import { useState } from 'react';
import { useConfirm } from '@/components/confirm-dialog';
import { btn, inputCls, tableHeadCls, toggleSmCls, toggleSmKnobCls } from '@/components/ui';

export interface ModelItem {
  id: string;
  provider_id: string;
  model_id: string;
  alias: string | null;
  display_name: string | null;
  enabled: boolean;
  input_price: number | null;
  output_price: number | null;
  context_window: number | null;
  synced: boolean;
}

interface Props {
  providerId: string;
  models: ModelItem[];
  /** 数据变更后通知父组件重新拉取模型列表 */
  onChanged: () => Promise<void> | void;
  onToast: (text: string, error?: boolean) => void;
}

/** 服务商卡片展开区内的模型管理表（同步/行内编辑/启停/删除/手动添加）。 */
export default function ModelTable({ providerId, models, onChanged, onToast }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ model_id: '', alias: '', display_name: '' });
  const [edits, setEdits] = useState<Record<string, { alias: string; input_price: string; output_price: string }>>({});
  const { confirm } = useConfirm();

  async function sync() {
    setSyncing(true);
    setSyncNotice('');
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/sync-models`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || '同步失败', true);
      } else {
        setSyncNotice(`同步完成：新增 ${data.added}，已存在 ${data.existing}，上游已移除 ${data.removed_not_in_upstream}`);
      }
      await onChanged();
    } finally {
      setSyncing(false);
    }
  }

  async function patchModel(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/models/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      onToast(data.error || '保存失败', true);
      return false;
    }
    return true;
  }

  function editOf(m: ModelItem) {
    return (
      edits[m.id] ?? {
        alias: m.alias ?? '',
        input_price: m.input_price?.toString() ?? '',
        output_price: m.output_price?.toString() ?? '',
      }
    );
  }

  function setEdit(m: ModelItem, patch: Partial<{ alias: string; input_price: string; output_price: string }>) {
    setEdits({ ...edits, [m.id]: { ...editOf(m), ...patch } });
  }

  async function saveRow(m: ModelItem) {
    const e = editOf(m);
    const ok = await patchModel(m.id, {
      alias: e.alias.trim() || null,
      input_price: e.input_price.trim() === '' ? null : Number(e.input_price),
      output_price: e.output_price.trim() === '' ? null : Number(e.output_price),
    });
    if (ok) {
      onToast('已保存');
      const next = { ...edits };
      delete next[m.id];
      setEdits(next);
      await onChanged();
    }
  }

  async function removeModel(m: ModelItem) {
    const ok = await confirm({ title: `删除模型「${m.model_id}」？`, confirmText: '删除' });
    if (!ok) return;
    await fetch(`/api/admin/models/${m.id}`, { method: 'DELETE' });
    await onChanged();
  }

  async function addModel(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_id: providerId,
        model_id: addForm.model_id,
        alias: addForm.alias.trim() || null,
        display_name: addForm.display_name.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      onToast(data.error || '添加失败', true);
      return;
    }
    onToast(`已添加 ${data.model.model_id}`);
    setShowAdd(false);
    setAddForm({ model_id: '', alias: '', display_name: '' });
    await onChanged();
  }

  return (
    <div className="border-t border-border px-4 py-5 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">模型（{models.length}）</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className={btn.ghost}
          >
            {syncing ? '同步中…' : '同步模型'}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className={btn.ghost}
            aria-expanded={showAdd}
          >
            + 手动添加
          </button>
        </div>
      </div>
      {syncNotice && <div className="mb-3 text-xs text-success" role="status">{syncNotice}</div>}

      {showAdd && (
        <form onSubmit={addModel} className="mb-4 grid gap-2 rounded-md border border-border bg-muted/50 p-3 sm:grid-cols-[minmax(12rem,1fr)_10rem_11rem_auto] sm:items-end">
          <input
            value={addForm.model_id}
            onChange={(e) => setAddForm({ ...addForm, model_id: e.target.value })}
            placeholder="模型 ID（上游真实名）"
            className={`w-full ${inputCls}`}
            required
          />
          <input
            value={addForm.alias}
            onChange={(e) => setAddForm({ ...addForm, alias: e.target.value })}
            placeholder="别名（可选）"
            className={`w-full ${inputCls}`}
          />
          <input
            value={addForm.display_name}
            onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })}
            placeholder="显示名（可选）"
            className={`w-full ${inputCls}`}
          />
          <button type="submit" className={btn.primary}>
            添加
          </button>
        </form>
      )}

      {models.length === 0 ? (
        <div className="py-6 text-center text-xs text-subtle-foreground">暂无模型，可从上游同步或手动添加</div>
      ) : (
        <div className="minimal-scrollbar -mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        <table className="w-full min-w-[760px] text-sm">
          <thead className={tableHeadCls}>
            <tr>
              <th className="px-3 py-2 font-medium">模型 ID</th>
              <th className="px-3 py-2 font-medium">别名</th>
              <th className="px-3 py-2 font-medium">输入 / 输出单价（$/M tokens）</th>
              <th className="px-3 py-2 font-medium">来源</th>
              <th className="px-3 py-2 font-medium">启用</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {models.map((m) => {
              const e = editOf(m);
              const dirty = !!edits[m.id];
              return (
                <tr key={m.id} className={m.enabled ? '' : 'opacity-50'}>
                  <td className="px-3 py-2.5 font-mono text-xs">{m.model_id}</td>
                  <td className="px-3 py-2.5">
                    <input
                      value={e.alias}
                      onChange={(ev) => setEdit(m, { alias: ev.target.value })}
                      className={`${inputCls} min-h-8 w-28 py-1 text-xs`}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      value={e.input_price}
                      onChange={(ev) => setEdit(m, { input_price: ev.target.value })}
                      className={`${inputCls} min-h-8 w-20 py-1 text-xs`}
                      placeholder="0"
                    />
                    {' / '}
                    <input
                      value={e.output_price}
                      onChange={(ev) => setEdit(m, { output_price: ev.target.value })}
                      className={`${inputCls} min-h-8 w-20 py-1 text-xs`}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-subtle-foreground">{m.synced ? '同步' : '手动'}</td>
                  <td className="px-3 py-2.5">
                    {/* 小开关（统一样式：36px 轨道 / 16px 圆点 / 位移 18px） */}
                    <button
                      type="button"
                      onClick={async () => {
                        await patchModel(m.id, { enabled: !m.enabled });
                        await onChanged();
                      }}
                      className={toggleSmCls(m.enabled)}
                      aria-label={m.enabled ? '禁用' : '启用'}
                    >
                      <span className={toggleSmKnobCls(m.enabled)} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-3 text-xs">
                      {dirty && (
                        <button type="button" onClick={() => saveRow(m)} className={btn.link}>
                          保存
                        </button>
                      )}
                      <button type="button" onClick={() => removeModel(m)} className={btn.linkDanger}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
