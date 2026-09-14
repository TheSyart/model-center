'use client';

import { useEffect, useState } from 'react';
import { Download, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { useConfirm } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [retentionDays, setRetentionDays] = useState<string>('');
  const [retentionMsg, setRetentionMsg] = useState('');
  const [allowHttp, setAllowHttp] = useState(false);
  const [balanceRefresh, setBalanceRefresh] = useState<string>('60');
  const [balanceMsg, setBalanceMsg] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const { confirm } = useConfirm();

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
    setPending('balance');
    setBalanceMsg('');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance_refresh_seconds: Number(balanceRefresh) }),
    });
    const data = await res.json();
    setBalanceMsg(res.ok ? '已保存' : data.error || '保存失败');
    setPending(null);
  }

  async function toggleAllowHttp(v: boolean) {
    setAllowHttp(v);
    setPending('security');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_http_providers: v }),
    });
    if (!res.ok) setAllowHttp(!v);
    setPending(null);
  }

  async function saveRetention() {
    setPending('retention');
    setRetentionMsg('');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_retention_days: Number(retentionDays) }),
    });
    const data = await res.json();
    setRetentionMsg(res.ok ? '已保存' : data.error || '保存失败');
    setPending(null);
  }

  async function purgeNow() {
    if (!(await confirm({ title: '立即清理过期日志？', description: '超过当前保留天数的日志会被永久删除。', confirmText: '立即清理' }))) return;
    setPending('purge');
    setRetentionMsg('');
    const res = await fetch('/api/admin/logs/purge', { method: 'POST' });
    const data = await res.json();
    setRetentionMsg(res.ok ? `已清理 ${data.deleted} 条过期日志` : data.error || '清理失败');
    setPending(null);
  }

  return (
    <div>
      <PageHeader heading="设置" description="调整日志、余额刷新、网络安全和配置迁移选项。" />
      <div className="max-w-4xl space-y-5">
        <Card>
          <CardHeader><CardTitle>运行</CardTitle><CardDescription>日志生命周期和服务商余额刷新策略。</CardDescription></CardHeader>
          <CardContent className="divide-y divide-border">
            <div className="pb-5">
              <div className="text-sm font-medium">请求日志保留</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">超过保留天数的日志会自动清理，也可立即执行一次清理。</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="sr-only">日志保留天数</span>
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">天</span>
                </label>
                <Button onClick={saveRetention} variant="outline" disabled={pending === 'retention'}>{pending === 'retention' ? '保存中…' : '保存'}</Button>
              </div>
              {retentionMsg && <p role="status" className="mt-3 text-sm text-muted-foreground">{retentionMsg}</p>}
            </div>

            <div className="py-5">
              <div className="text-sm font-medium">余额自动刷新</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">页面可见时按设定间隔刷新服务商余额，填 0 可关闭。</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="sr-only">余额自动刷新间隔</span>
                  <Input
                    type="number"
                    min={0}
                    max={86400}
                    value={balanceRefresh}
                    onChange={(e) => setBalanceRefresh(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">秒</span>
                </label>
                <Button onClick={saveBalanceRefresh} variant="outline" disabled={pending === 'balance'}>{pending === 'balance' ? '保存中…' : '保存'}</Button>
                {balanceMsg && <span role="status" className="text-sm text-muted-foreground">{balanceMsg}</span>}
              </div>
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>安全</CardTitle><CardDescription>控制服务商地址的网络访问边界。</CardDescription></CardHeader>
          <CardContent><div className="flex items-start justify-between gap-5"><div><div className="text-sm font-medium">允许非 localhost 的 HTTP 服务商</div><p className="mt-1 text-sm leading-6 text-muted-foreground">默认关闭以降低 SSRF 风险；localhost 始终放行。</p></div><Switch checked={allowHttp} disabled={pending === 'security'} onCheckedChange={toggleAllowHttp} aria-label="允许非 localhost 的 HTTP 服务商" /></div></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>导入 / 导出</CardTitle><CardDescription>迁移服务商、端点、模型、别名和提示词配置；API Key 默认脱敏，旧版单端点文件仍可导入。订阅账号、关联模型及别名中的订阅目标不包含在导出中；迁移后需重新登录并接入。</CardDescription></CardHeader>
          <CardContent><ExportImport /></CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="size-5" />Danger Zone</CardTitle><CardDescription>不可恢复的数据清理操作。</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-medium">清理过期请求日志</div><p className="mt-1 text-sm text-muted-foreground">按上方配置的保留天数立即清理。</p></div><Button onClick={purgeNow} variant="destructive" disabled={pending === 'purge'}><Trash2 className="size-4" />{pending === 'purge' ? '清理中…' : '立即清理'}</Button></CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExportImport() {
  const [includeKeys, setIncludeKeys] = useState(false);
  const [msg, setMsg] = useState('');
  const { confirm } = useConfirm();

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
          className={cn(buttonVariants({ variant: 'outline' }))}
          onClick={async (e) => {
            if (!includeKeys) return;
            e.preventDefault();
            if (await confirm({ title: '导出明文 API Key？', description: '导出文件将包含所有 api_key 明文，请妥善保管。', confirmText: '继续导出' })) window.location.href = `/api/admin/export?include_keys=1`;
          }}
        >
          <Download className="size-4" />导出 JSON
        </a>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={includeKeys} onCheckedChange={(checked) => setIncludeKeys(checked === true)} />
          包含 api_key 明文
        </label>
      </div>
      <div>
        <label className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer')}>
          <Upload className="size-4" />导入 JSON…
          <input type="file" accept="application/json" className="hidden" onChange={onImport} />
        </label>
      </div>
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
