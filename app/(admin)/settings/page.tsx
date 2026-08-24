'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { btn, cardCls, inputCls, sectionTitleCls } from '@/components/ui';

export default function SettingsPage() {
  const [retentionDays, setRetentionDays] = useState<string>('');
  const [retentionMsg, setRetentionMsg] = useState('');
  const [allowHttp, setAllowHttp] = useState(false);
  const [balanceRefresh, setBalanceRefresh] = useState<string>('60');
  const [balanceMsg, setBalanceMsg] = useState('');

  async function load() {
    const res = await fetch('/api/admin/settings');
    if (res.ok) {
      const data = await res.json();
      setRetentionDays(String(data.log_retention_days ?? 30));
      setAllowHttp(!!data.allow_http_providers);
      setBalanceRefresh(String(data.balance_refresh_seconds ?? 60));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveBalanceRefresh() {
    setBalanceMsg('');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance_refresh_seconds: Number(balanceRefresh) }),
    });
    const data = await res.json();
    setBalanceMsg(res.ok ? '已保存' : data.error || '保存失败');
  }

  async function toggleAllowHttp(v: boolean) {
    setAllowHttp(v);
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_http_providers: v }),
    });
  }

  async function saveRetention() {
    setRetentionMsg('');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_retention_days: Number(retentionDays) }),
    });
    const data = await res.json();
    setRetentionMsg(res.ok ? '已保存' : data.error || '保存失败');
  }

  async function purgeNow() {
    setRetentionMsg('');
    const res = await fetch('/api/admin/logs/purge', { method: 'POST' });
    const data = await res.json();
    setRetentionMsg(res.ok ? `已清理 ${data.deleted} 条过期日志` : data.error || '清理失败');
  }

  return (
    <div>
      <PageHeader heading="设置" description="调整日志、余额刷新、网络安全和配置迁移选项。" />
      <div className="max-w-3xl space-y-6">
        <section className={`${cardCls} p-5 sm:p-6`}>
          <h2 className={sectionTitleCls}>运行设置</h2>
          <div className="mt-5 divide-y divide-border">
            <div className="pb-5">
              <div className="text-sm font-medium">请求日志保留</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">超过保留天数的日志会自动清理，也可立即执行一次清理。</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="sr-only">日志保留天数</span>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                    className={`w-24 ${inputCls}`}
                  />
                  <span className="text-sm text-muted-foreground">天</span>
                </label>
                <button onClick={saveRetention} className={btn.ghost}>保存</button>
                <button onClick={purgeNow} className={btn.danger}>立即清理</button>
              </div>
              {retentionMsg && <p role="status" className="mt-3 text-sm text-muted-foreground">{retentionMsg}</p>}
            </div>

            <div className="py-5">
              <div className="text-sm font-medium">余额自动刷新</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">页面可见时按设定间隔刷新服务商余额，填 0 可关闭。</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="sr-only">余额自动刷新间隔</span>
                  <input
                    type="number"
                    min={0}
                    max={86400}
                    value={balanceRefresh}
                    onChange={(e) => setBalanceRefresh(e.target.value)}
                    className={`w-24 ${inputCls}`}
                  />
                  <span className="text-sm text-muted-foreground">秒</span>
                </label>
                <button onClick={saveBalanceRefresh} className={btn.ghost}>保存</button>
                {balanceMsg && <span role="status" className="text-sm text-muted-foreground">{balanceMsg}</span>}
              </div>
            </div>

            <label className="flex items-start gap-3 pt-5 text-sm leading-6 text-muted-foreground">
              <input
                type="checkbox"
                checked={allowHttp}
                onChange={(e) => toggleAllowHttp(e.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block font-medium text-foreground">允许非 localhost 的 HTTP 服务商</span>
                默认关闭以降低 SSRF 风险；localhost 始终放行。
              </span>
            </label>
          </div>
        </section>

        <section className={`${cardCls} p-5 sm:p-6`}>
          <h2 className={sectionTitleCls}>导入 / 导出</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">迁移服务商、模型、别名和提示词配置；API Key 默认脱敏。</p>
          <div className="mt-5"><ExportImport /></div>
        </section>
      </div>
    </div>
  );
}

function ExportImport() {
  const [includeKeys, setIncludeKeys] = useState(false);
  const [msg, setMsg] = useState('');

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg('');
    try {
      const text = await file.text();
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || '导入失败');
        return;
      }
      setMsg(
        `导入完成：服务商 +${data.providers.added}（跳过 ${data.providers.skipped.length}），模型 +${data.models.added}，别名 +${data.aliases.added}，提示词 +${data.prompts.added}`,
      );
    } catch {
      setMsg('文件读取失败');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`/api/admin/export${includeKeys ? '?include_keys=1' : ''}`}
          className={btn.ghost}
          onClick={(e) => {
            if (includeKeys && !window.confirm('导出文件将包含 api_key 明文，确定继续？')) e.preventDefault();
          }}
        >
          导出 JSON
        </a>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={includeKeys} onChange={(e) => setIncludeKeys(e.target.checked)} className="h-4 w-4 accent-primary" />
          包含 api_key 明文
        </label>
      </div>
      <div>
        <label className={btn.ghost}>
          导入 JSON…
          <input type="file" accept="application/json" className="hidden" onChange={onImport} />
        </label>
      </div>
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
