'use client';

import { useState } from 'react';
import { useConfirm } from '@/components/confirm-dialog';
import { btn, inputCls, tableHeadCls } from '@/components/ui/styles';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  isOfficialBailianCatalogProvider,
  BAILIAN_PROVIDERS,
  BAILIAN_CAPABILITIES,
  type BailianCatalogFilterOptions,
} from '@/lib/vendors/bailian/catalog';
import type { ModelCapabilityTag } from '@/lib/services/model-capabilities';

export interface ModelItem {
  id: string;
  provider_id: string;
  model_id: string;
  alias: string | null;
  display_name: string | null;
  enabled: boolean;
  input_price: number | null;
  output_price: number | null;
  cache_read_price: number | null;
  cache_write_price: number | null;
  pricing_source: string | null;
  pricing_source_ref: string | null;
  pricing_synced_at: number | null;
  context_window: number | null;
  synced: boolean;
  capabilities?: ModelCapabilityTag[];
}

interface ProviderSummary {
  id: string;
  slug: string;
  preset_key?: string | null;
}

interface Props {
  providerId: string;
  provider?: ProviderSummary;
  models: ModelItem[];
  /** 数据变更后通知父组件重新拉取模型列表 */
  onChanged: () => Promise<void> | void;
  onToast: (text: string, error?: boolean) => void;
}

function tagBadgeColor(color: string): string {
  switch (color) {
    case 'blue':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    case 'purple':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    case 'amber':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    case 'emerald':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    case 'cyan':
      return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
    case 'indigo':
      return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

/** 服务商卡片展开区内的模型管理表（同步/行内编辑/启停/删除/手动添加）。 */
export default function ModelTable({ providerId, provider, models, onChanged, onToast }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showBailianFilter, setShowBailianFilter] = useState(false);
  const [selectedBailianProviders, setSelectedBailianProviders] = useState<string[]>([]);
  const [selectedBailianCaps, setSelectedBailianCaps] = useState<string[]>([]);
  const [addForm, setAddForm] = useState({ model_id: '', alias: '', display_name: '' });
  type ModelEdit = { alias: string; input_price: string; output_price: string; cache_read_price: string; cache_write_price: string };
  const [edits, setEdits] = useState<Record<string, ModelEdit>>({});
  const { confirm } = useConfirm();

  const isBailian = provider ? isOfficialBailianCatalogProvider({ slug: provider.slug, presetKey: provider.preset_key }) : false;

  async function executeSync(filter?: BailianCatalogFilterOptions) {
    setSyncing(true);
    setSyncNotice('');
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/sync-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: filter ? JSON.stringify({ filter }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || '同步失败', true);
      } else {
        const parts = [`新增 ${data.added}`, `已存在 ${data.existing}`];
        if (data.repriced) parts.push(`刷新价格 ${data.repriced}`);
        if (filter) {
          parts.push(`移除 ${data.removed ?? 0}`);
          if (data.kept_manual) parts.push(`保留手动添加 ${data.kept_manual}`);
          if (data.kept_referenced) parts.push(`保留别名引用 ${data.kept_referenced}`);
        } else if (data.removed_not_in_upstream) {
          parts.push(`上游已移除 ${data.removed_not_in_upstream}（未删除）`);
        }
        setSyncNotice(`同步完成：${parts.join('，')}`);
      }
      await onChanged();
    } finally {
      setSyncing(false);
      setShowBailianFilter(false);
    }
  }

  function handleBailianFilterSync() {
    const filter: BailianCatalogFilterOptions = {};
    if (selectedBailianProviders.length > 0) filter.providers = selectedBailianProviders;
    if (selectedBailianCaps.length > 0) filter.capabilities = selectedBailianCaps;
    executeSync(Object.keys(filter).length > 0 ? filter : undefined);
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
        cache_read_price: m.cache_read_price?.toString() ?? '',
        cache_write_price: m.cache_write_price?.toString() ?? '',
      }
    );
  }

  function setEdit(m: ModelItem, patch: Partial<ModelEdit>) {
    setEdits({ ...edits, [m.id]: { ...editOf(m), ...patch } });
  }

  async function saveRow(m: ModelItem) {
    const e = editOf(m);
    const ok = await patchModel(m.id, {
      alias: e.alias.trim() || null,
      input_price: e.input_price.trim() === '' ? null : Number(e.input_price),
      output_price: e.output_price.trim() === '' ? null : Number(e.output_price),
      cache_read_price: e.cache_read_price.trim() === '' ? null : Number(e.cache_read_price),
      cache_write_price: e.cache_write_price.trim() === '' ? null : Number(e.cache_write_price),
    });
    if (ok) {
      onToast('已保存');
      const next = { ...edits };
      delete next[m.id];
      setEdits(next);
      await onChanged();
    }
  }

  async function restorePricing(m: ModelItem) {
    const ok = await patchModel(m.id, { restore_pricing: true });
    if (!ok) return;
    onToast('已恢复 CC Switch 定价');
    const next = { ...edits };
    delete next[m.id];
    setEdits(next);
    await onChanged();
  }

  function pricingSourceLabel(source: string | null) {
    if (source === 'manual') return '手动';
    if (source === 'cc-switch-provider') return 'CC Switch · 服务商';
    if (source === 'cc-switch-global') return 'CC Switch · 全局';
    return '未定价';
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
          {isBailian ? (
            <>
              <button
                type="button"
                onClick={() => executeSync()}
                disabled={syncing}
                className={btn.ghost}
                title="全量同步百炼官方模型目录"
              >
                {syncing ? '同步中…' : '全量同步'}
              </button>
              <button
                type="button"
                onClick={() => setShowBailianFilter(true)}
                disabled={syncing}
                className={`${btn.ghost} text-primary font-medium`}
                title="按系列（千问/DeepSeek等）或类型（文本/ASR/TTS等）筛选同步"
              >
                筛选同步…
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => executeSync()}
              disabled={syncing}
              className={btn.ghost}
            >
              {syncing ? '同步中…' : '同步模型'}
            </button>
          )}
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

      {/* 百炼专属多系列与多模态筛选对话框 */}
      {isBailian && (
        <Dialog open={showBailianFilter} onOpenChange={setShowBailianFilter}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>百炼模型筛选同步</DialogTitle>
              <DialogDescription>
                选择要同步的厂商系列与模型能力类型。未选择任何项时默认拉取全部模型。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* 系列选择 */}
              <div>
                <div className="mb-2 flex items-center justify-between font-medium text-foreground">
                  <span>模型厂商系列（providers）</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBailianProviders(BAILIAN_PROVIDERS.map((p) => p.id))}
                      className="text-primary hover:underline"
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBailianProviders([])}
                      className="text-muted-foreground hover:underline"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {BAILIAN_PROVIDERS.map((p) => {
                    const checked = selectedBailianProviders.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors ${
                          checked ? 'border-primary/50 bg-primary/10 text-primary font-medium' : 'border-border bg-muted/30 text-muted-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBailianProviders([...selectedBailianProviders, p.id]);
                            } else {
                              setSelectedBailianProviders(selectedBailianProviders.filter((id) => id !== p.id));
                            }
                          }}
                          className="size-3.5 rounded border-border"
                        />
                        <span className="truncate">{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 能力类型选择 */}
              <div>
                <div className="mb-2 flex items-center justify-between font-medium text-foreground">
                  <span>能力与模态类型（capabilities）</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBailianCaps(BAILIAN_CAPABILITIES.map((c) => c.id))}
                      className="text-primary hover:underline"
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBailianCaps([])}
                      className="text-muted-foreground hover:underline"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {BAILIAN_CAPABILITIES.map((c) => {
                    const checked = selectedBailianCaps.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors ${
                          checked ? 'border-primary/50 bg-primary/10 text-primary font-medium' : 'border-border bg-muted/30 text-muted-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBailianCaps([...selectedBailianCaps, c.id]);
                            } else {
                              setSelectedBailianCaps(selectedBailianCaps.filter((id) => id !== c.id));
                            }
                          }}
                          className="size-3.5 rounded border-border"
                        />
                        <span className="truncate">{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowBailianFilter(false)}
                className={btn.ghost}
                disabled={syncing}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleBailianFilterSync}
                className={btn.primary}
                disabled={syncing}
              >
                {syncing ? '同步中…' : '开始筛选同步'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
        <div className="py-6 text-center text-xs text-subtle-foreground">暂无模型，请添加账号可用的模型 ID</div>
      ) : (
        <div className="minimal-scrollbar -mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        <table className="w-full min-w-[980px] text-sm">
          <thead className={tableHeadCls}>
            <tr>
              <th className="px-3 py-2 font-medium">模型 ID</th>
              <th className="px-3 py-2 font-medium">别名</th>
              <th className="px-3 py-2 font-medium">四档单价（$/M tokens）</th>
              <th className="px-3 py-2 font-medium">定价来源</th>
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
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-medium text-foreground">{m.model_id}</span>
                        {m.context_window && (
                          <span
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            title={`上下文窗口：${m.context_window} tokens`}
                          >
                            {m.context_window >= 1_000_000
                              ? `${(m.context_window / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
                              : `${Math.round(m.context_window / 1_000)}k`}
                          </span>
                        )}
                      </div>
                      {m.display_name && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-xs">{m.display_name}</div>
                      )}
                      {m.capabilities && m.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {m.capabilities.map((tag) => (
                            <span
                              key={tag.id}
                              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] leading-tight font-medium ${tagBadgeColor(
                                tag.color,
                              )}`}
                              title={tag.description}
                            >
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      value={e.alias}
                      onChange={(ev) => setEdit(m, { alias: ev.target.value })}
                      className={`${inputCls} min-h-8 w-28 py-1 text-xs`}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        ['输入', 'input_price'],
                        ['输出', 'output_price'],
                        ['缓存读', 'cache_read_price'],
                        ['缓存写', 'cache_write_price'],
                      ] as const).map(([label, key]) => (
                        <label key={key} className="block">
                          <span className="mb-1 block text-[10px] text-subtle-foreground">{label}</span>
                          <input
                            value={e[key]}
                            onChange={(ev) => setEdit(m, { [key]: ev.target.value })}
                            className={`${inputCls} min-h-8 w-20 py-1 text-xs`}
                            placeholder="—"
                            inputMode="decimal"
                          />
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-subtle-foreground" title={m.pricing_source_ref ?? undefined}>
                    <div>{pricingSourceLabel(m.pricing_source)}</div>
                    <div className="mt-1 text-[10px]">模型：{m.synced ? '上游同步' : '手动添加'}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Switch
                      checked={m.enabled}
                      onCheckedChange={async () => {
                        await patchModel(m.id, { enabled: !m.enabled });
                        await onChanged();
                      }}
                      aria-label={m.enabled ? '禁用' : '启用'}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-3 text-xs">
                      {dirty && (
                        <button type="button" onClick={() => saveRow(m)} className={btn.link}>
                          保存
                        </button>
                      )}
                      <button type="button" onClick={() => restorePricing(m)} className={btn.link}>
                        恢复定价
                      </button>
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
