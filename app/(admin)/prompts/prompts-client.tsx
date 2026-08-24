'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { btn, cardCls, inputCls, tableHeadCls, tableWrapCls } from '@/components/ui';

interface Prompt {
  id: string;
  name: string;
  content: string;
  description: string | null;
  vars: string[];
  updated_at: number | null;
}

interface FormState {
  id: string | null;
  name: string;
  description: string;
  content: string;
}

const EMPTY_FORM: FormState = { id: null, name: '', description: '', content: '' };

// 与服务端 lib/services/prompt.ts 同一渲染规则：{{var}} 替换，未提供的保留原样
const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function detectVars(content: string): string[] {
  return [...new Set([...content.matchAll(VAR_RE)].map((m) => m[1]))];
}

function renderPreview(content: string, vars: Record<string, string>): string {
  return content.replace(VAR_RE, (raw, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : raw,
  );
}

export default function PromptsClient() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { confirm } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/prompts');
    if (res.ok) setPrompts((await res.json()).prompts);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formVars = useMemo(() => (form ? detectVars(form.content) : []), [form]);
  const preview = useMemo(
    () => (form ? renderPreview(form.content, varValues) : ''),
    [form, varValues],
  );

  function openForm(p?: Prompt) {
    setError('');
    setVarValues({});
    setForm(
      p
        ? { id: p.id, name: p.name, description: p.description ?? '', content: p.content }
        : { ...EMPTY_FORM },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    setSaving(true);
    try {
      const isEdit = form.id !== null;
      const res = await fetch(isEdit ? `/api/admin/prompts/${form.id}` : '/api/admin/prompts', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, content: form.content, description: form.description }),
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

  async function onDelete(p: Prompt) {
    if (!(await confirm({ title: `删除提示词「${p.name}」？`, confirmText: '删除' }))) return;
    await fetch(`/api/admin/prompts/${p.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <button
          onClick={() => openForm()}
          className={btn.primary}
        >
          + 新建提示词
        </button>
      </div>

      {form && (
        <form onSubmit={onSubmit} className={`mb-6 ${cardCls} p-5 sm:p-6`}>
          <h2 className="mb-5 text-base font-semibold tracking-[-0.02em]">{form.id ? '编辑提示词' : '新建提示词'}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted-foreground">名称（唯一，网关用 prompt_name 引用）</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="code-review"
                className={`w-full ${inputCls}`}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted-foreground">描述</span>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={`w-full ${inputCls}`}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm text-muted-foreground">内容（支持 {'{{变量}}'} 占位）</span>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
                placeholder={'你是资深工程师，请用{{language}}审查以下代码…'}
                className={`w-full ${inputCls} font-mono`}
                required
              />
            </label>
          </div>

          {formVars.length > 0 && (
            <div className="mt-4 rounded-md border border-border bg-muted/45 p-4">
              <div className="mb-2 text-sm text-muted-foreground">
                检测到变量：
                {formVars.map((v) => (
                  <code key={v} className="ml-1 rounded-sm bg-surface px-1.5 py-0.5 text-xs text-primary">
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {formVars.map((v) => (
                  <input
                    key={v}
                    value={varValues[v] ?? ''}
                    onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })}
                    placeholder={`${v} 的值`}
                    className={inputCls}
                  />
                ))}
              </div>
              <pre className="minimal-scrollbar mt-3 max-h-48 overflow-auto rounded-md border border-border bg-surface p-3 text-sm whitespace-pre-wrap">
                {preview}
              </pre>
            </div>
          )}

          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
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
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">描述</th>
              <th className="px-4 py-3 font-medium">变量</th>
              <th className="px-4 py-3 font-medium">更新时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5}>
                  <SkeletonRows rows={2} />
                </td>
              </tr>
            ) : prompts.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    title="还没有提示词"
                    description="创建预设提示词，网关请求可用 prompt_name 注入"
                    actionLabel="新建提示词"
                    onAction={() => openForm()}
                  />
                </td>
              </tr>
            ) : (
              prompts.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-muted/35">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="max-w-64 truncate px-4 py-3 text-muted-foreground" title={p.description ?? ''}>
                    {p.description || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.vars.length
                      ? p.vars.map((v) => (
                          <code key={v} className="mr-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {v}
                          </code>
                        ))
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.updated_at ? new Date(p.updated_at).toLocaleString('zh-CN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => openForm(p)} className={btn.link}>
                        编辑
                      </button>
                      <button onClick={() => onDelete(p)} className={btn.linkDanger}>
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
