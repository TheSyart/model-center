'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, RefreshCw, Link2, Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useConfirm } from '@/components/confirm-dialog';
import type {
  AccountView,
  SubscriptionVendor,
} from '@/lib/subscriptions/types';

const names: Record<SubscriptionVendor, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
};
const endpoint = '/api/admin/subscriptions';
const date = (value: number | null) =>
  value
    ? new Date(value).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '未知';
type Session = { id: string; url: string; expiresAt: number };
type Login = { vendor: SubscriptionVendor; reconnectId?: string };
async function api(
  path = '',
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
) {
  const response = await fetch(endpoint + path, {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === 'string' ? data.error : '操作失败，请稍后重试'
    );
  return data;
}

export default function SubscriptionsClient() {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [login, setLogin] = useState<Login | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [project, setProject] = useState('');
  const [input, setInput] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [gateway, setGateway] = useState<AccountView | null>(null);
  const [models, setModels] = useState('');
  const active = useRef<AbortController | null>(null);
  const { confirm } = useConfirm();
  const load = useCallback(async () => {
    try {
      setAccounts((await api()).accounts);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60000);
    return () => {
      clearInterval(timer);
      active.current?.abort();
    };
  }, [load]);
  const update = (account: AccountView) =>
    setAccounts((list) =>
      list.some((a) => a.id === account.id)
        ? list.map((a) => (a.id === account.id ? account : a))
        : [...list, account]
    );
  async function action(
    id: string,
    path: string,
    method = 'POST',
    body: unknown = {}
  ) {
    setBusy(id);
    setError('');
    try {
      const result = await api(
        path,
        method,
        method === 'DELETE' ? undefined : body
      );
      if (result.account) update(result.account);
      else await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  function openLogin(value: Login) {
    setLogin(value);
    setSession(null);
    setProject(
      accounts.find((a) => a.id === value.reconnectId)?.projectId ?? ''
    );
    setInput('');
    setDialogError('');
  }
  function closeLogin() {
    active.current?.abort();
    active.current = null;
    if (session) void api(`/oauth/${session.id}`, 'DELETE').catch(() => {});
    setLogin(null);
    setSession(null);
    setInput('');
    setBusy(null);
  }
  async function startLogin() {
    if (!login) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy('login');
    setDialogError('');
    try {
      const result = await api(
        '/oauth',
        'POST',
        { ...login, ...(project.trim() ? { projectId: project.trim() } : {}) },
        controller.signal
      );
      if (!controller.signal.aborted) setSession(result.session);
    } catch (e) {
      if (!controller.signal.aborted) setDialogError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(null);
    }
  }
  async function completeLogin() {
    if (!session) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy('login');
    setDialogError('');
    try {
      const result = await api(
        '/oauth/complete',
        'POST',
        { sessionId: session.id, input: input.trim() },
        controller.signal
      );
      if (!controller.signal.aborted) {
        update(result.account);
        setLogin(null);
        setSession(null);
        setInput('');
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setDialogError(`${(e as Error).message}。请生成新的授权链接后重试。`);
        setSession(null);
        setInput('');
      }
    } finally {
      if (!controller.signal.aborted) setBusy(null);
    }
  }
  async function refreshAll() {
    setBusy('all');
    setError('');
    try {
      const pending = accounts.filter((a) => a.enabled);
      for (let i = 0; i < pending.length; i += 3) {
        const results = await Promise.all(
          pending.slice(i, i + 3).map((a) => api(`/${a.id}/quota`, 'POST', {}))
        );
        results.forEach((r) => update(r.account));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function saveGateway() {
    if (!gateway) return;
    setBusy(gateway.id);
    setDialogError('');
    try {
      update(
        (
          await api(`/${gateway.id}/gateway`, 'POST', {
            models: models
              .split(/[\n,]/)
              .map((s) => s.trim())
              .filter(Boolean),
          })
        ).account
      );
      setGateway(null);
    } catch (e) {
      setDialogError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div>
      <PageHeader
        heading="订阅账号"
        description="登录 Claude Code、Codex 和 Gemini CLI，集中查看套餐额度，并通过 Model Center 网关调用。"
        actions={
          <Button
            variant="outline"
            onClick={refreshAll}
            disabled={!!busy || !accounts.some((a) => a.enabled)}
          >
            <RefreshCw className={busy === 'all' ? 'animate-spin' : ''} />
            刷新全部额度
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(Object.keys(names) as SubscriptionVendor[]).map((v) => (
          <Button
            key={v}
            variant="outline"
            disabled={!!busy}
            onClick={() => openLogin({ vendor: v })}
          >
            登录 {names[v]}
          </Button>
        ))}
      </div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}{' '}
          <button className="underline" onClick={load}>
            重试加载
          </button>
        </div>
      )}
      {loading ? (
        <p className="py-10 text-sm text-muted-foreground" role="status">
          正在加载账号…
        </p>
      ) : !accounts.length ? (
        <div className="rounded-lg border border-dashed bg-surface px-6 py-16 text-center">
          <Users className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h2 className="font-semibold">添加你的第一个订阅账号</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            选择上方服务，前往官方页面授权。登录后可以查看额度，再选择模型接入网关。
          </p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {accounts.map((a) => (
            <article
              key={a.id}
              className="min-w-0 rounded-lg border bg-surface"
            >
              <div className="flex items-start justify-between gap-3 border-b p-5">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {names[a.vendor]}
                    </span>
                    <Badge
                      variant={
                        a.authStatus === 'needs_reauth'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {!a.enabled
                        ? '已禁用'
                        : a.authStatus === 'needs_reauth'
                          ? '需要重新登录'
                          : '已登录'}
                    </Badge>
                    {a.quota?.plan && (
                      <Badge variant="outline">{a.quota.plan}</Badge>
                    )}
                  </div>
                  <h2 className="break-all font-semibold">{a.displayName}</h2>
                  {a.projectId && (
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      项目 {a.projectId}
                    </p>
                  )}
                </div>
                <Switch
                  aria-label={`启用 ${a.displayName}`}
                  checked={a.enabled}
                  disabled={!!busy}
                  onCheckedChange={(enabled) =>
                    void action(a.id, `/${a.id}`, 'PATCH', { enabled })
                  }
                />
              </div>
              <div className="space-y-4 p-5">
                {a.lastError && (
                  <p className="text-sm text-destructive">{a.lastError}</p>
                )}
                {a.quotaError && (
                  <p
                    className="rounded-md bg-muted p-3 text-xs leading-5"
                    role="status"
                  >
                    {a.quotaError}
                    {a.quota
                      ? '；保留上次成功数据，以下额度可能已过时。'
                      : '；尚无可用额度数据。'}
                  </p>
                )}
                {!a.quota?.windows.length ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    暂无额度窗口，请刷新额度查看。
                  </p>
                ) : (
                  a.quota.windows.map((w) => (
                    <div key={w.id}>
                      <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                        <span>
                          {w.label}
                          {w.modelId && w.modelId !== w.label && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {w.modelId}
                            </span>
                          )}
                        </span>
                        <span className="font-medium tabular-nums">
                          {w.remainingPercent === null
                            ? '剩余额度未知'
                            : `剩余 ${Math.round(w.remainingPercent * 10) / 10}%`}
                        </span>
                      </div>
                      {w.remainingPercent !== null && (
                        <Progress
                          aria-label={`${w.label}剩余额度`}
                          value={w.remainingPercent}
                          indicatorClassName={
                            w.remainingPercent < 15
                              ? 'bg-destructive'
                              : undefined
                          }
                        />
                      )}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        重置时间：{date(w.resetAt)}
                      </p>
                    </div>
                  ))
                )}
                <p className="text-xs text-muted-foreground">
                  上次更新：{date(a.quota?.checkedAt ?? null)}
                  {a.quota && Date.now() - a.quota.checkedAt > 300000
                    ? ' · 快照超过 5 分钟，建议刷新'
                    : ''}
                </p>
                {a.providerSlug && (
                  <div className="rounded-md bg-muted p-3 text-xs leading-5">
                    <div className="mb-1 flex items-center gap-1 font-medium">
                      <Link2 className="size-3.5" />
                      已接入网关
                    </div>
                    <code className="break-all">{a.providerSlug}/模型ID</code>
                    <p className="mt-1 text-muted-foreground">
                      使用现有网关令牌调用，可在
                      <Link href="/aliases" className="underline">
                        别名
                      </Link>
                      中配置路由。
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t px-5 py-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!busy || !a.enabled}
                  onClick={() => void action(a.id, `/${a.id}/quota`)}
                >
                  刷新额度
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    openLogin({ vendor: a.vendor, reconnectId: a.id })
                  }
                >
                  重新登录
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!busy || !a.enabled || a.authStatus !== 'ready'}
                  onClick={() => {
                    setGateway(a);
                    setModels('');
                    setDialogError('');
                  }}
                >
                  {a.providerId ? '添加模型' : '接入网关'}
                </Button>
                {a.providerId ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!busy}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: '断开网关接入？',
                          description:
                            '将移除关联服务商和模型。若别名仍引用这些模型，需要先移除引用。',
                          confirmText: '断开接入',
                        })
                      )
                        void action(a.id, `/${a.id}/gateway`, 'DELETE');
                    }}
                  >
                    断开接入
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!busy}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: '删除此账号？',
                          description:
                            '删除本地授权凭据和额度快照。之后可以重新登录。',
                          confirmText: '删除账号',
                        })
                      )
                        void action(a.id, `/${a.id}`, 'DELETE');
                    }}
                  >
                    删除账号
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        额度来自各厂商返回的套餐窗口，不同账号的额度不能合并。订阅调用不计为 API
        账单；实际模型权限以账号套餐为准。
      </p>
      <Dialog
        open={!!login}
        onOpenChange={(open) => {
          if (!open) closeLogin();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>登录 {login ? names[login.vendor] : ''}</DialogTitle>
            <DialogDescription>
              在官方页面完成授权，将授权结果粘贴回此处。凭据仅在服务端加密保存。
            </DialogDescription>
          </DialogHeader>
          {dialogError && (
            <p role="alert" className="text-sm text-destructive">
              {dialogError}
            </p>
          )}
          {!session ? (
            <>
              {login?.vendor === 'gemini' && (
                <div className="space-y-2">
                  <label
                    htmlFor="google-project"
                    className="text-sm font-medium"
                  >
                    Google 项目 ID（可选）
                  </label>
                  <Input
                    id="google-project"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="使用已有项目时填写"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    个人账号可留空，由 Google
                    检查可用项目；组织账号可能需要指定已启用 Gemini for Google
                    Cloud 的项目。
                  </p>
                </div>
              )}
              <DialogFooter>
                <Button onClick={startLogin} disabled={!!busy}>
                  {busy === 'login' ? '正在准备…' : '生成授权链接'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <a
                href={session.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium hover:bg-muted"
              >
                打开官方授权页
                <ExternalLink className="size-4" />
              </a>
              <p className="text-xs leading-5 text-muted-foreground">
                {login?.vendor === 'gemini'
                  ? '复制官方页面显示的授权码。'
                  : '授权后浏览器可能显示本地地址无法访问，这是正常的；复制地址栏中的完整回调 URL。'}{' '}
                链接有效至 {date(session.expiresAt)}。
              </p>
              <div className="space-y-2">
                <label htmlFor="oauth-result" className="text-sm font-medium">
                  授权结果
                </label>
                <Textarea
                  id="oauth-result"
                  autoComplete="off"
                  spellCheck={false}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    login?.vendor === 'gemini'
                      ? '粘贴授权码'
                      : '粘贴完整回调 URL'
                  }
                  className="min-h-24"
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={completeLogin}
                  disabled={!!busy || !input.trim()}
                >
                  {busy === 'login' ? '正在验证授权…' : '完成登录'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!gateway}
        onOpenChange={(open) => {
          if (!open) setGateway(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {gateway?.providerId
                ? '添加可调用模型'
                : '接入 Model Center 网关'}
            </DialogTitle>
            <DialogDescription>
              填写此账号有权限使用的模型 ID，每行一个。保存后可用“服务商
              slug/模型 ID”调用，也可配置别名。
            </DialogDescription>
          </DialogHeader>
          {dialogError && (
            <p role="alert" className="text-sm text-destructive">
              {dialogError}
            </p>
          )}
          <label htmlFor="gateway-models" className="text-sm font-medium">
            模型 ID
          </label>
          <Textarea
            id="gateway-models"
            value={models}
            onChange={(e) => setModels(e.target.value)}
            placeholder="填写官方客户端中可用的模型 ID"
            className="min-h-32"
          />
          <p className="text-xs text-muted-foreground">
            保存模型不会验证套餐权限。实际调用失败时，请检查模型名称、授权状态和剩余额度。
          </p>
          <DialogFooter>
            <Button onClick={saveGateway} disabled={!!busy || !models.trim()}>
              保存接入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
