import { PROVIDER_PRESETS } from '@/lib/presets';
import { buildSubscriptionCatalog } from '@/lib/subscriptions/catalog';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionsClient from '@/app/(admin)/subscriptions/subscriptions-client';
const account = {
  id: 'a',
  vendor: 'codex',
  email: 'demo@example.com',
  displayName: 'demo@example.com',
  enabled: true,
  authStatus: 'ready',
  expiresAt: Date.now() + 3600000,
  projectId: null,
  lastError: null,
  quotaError: '额度查询失败',
  quotaAttemptedAt: Date.now(),
  providerId: null,
  providerSlug: null,
  quota: {
    checkedAt: Date.now() - 600000,
    plan: 'plus',
    windows: [
      {
        id: 'five',
        label: '5 小时',
        modelId: null,
        usedPercent: 100,
        remainingPercent: 0,
        resetAt: null,
        windowSeconds: 18000,
      },
      {
        id: 'week',
        label: '每周',
        modelId: null,
        usedPercent: null,
        remainingPercent: null,
        resetAt: null,
        windowSeconds: null,
      },
    ],
  },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('subscription accounts UI', () => {
  it('distinguishes exhausted, unknown and stale quota', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ accounts: [account] }))
    );
    render(
      <SubscriptionsClient
        catalog={buildSubscriptionCatalog(PROVIDER_PRESETS)}
      />
    );
    expect(await screen.findByText('demo@example.com')).toBeInTheDocument();
    expect(screen.getByText('剩余 0%')).toBeInTheDocument();
    expect(screen.getByText('剩余额度未知')).toBeInTheDocument();
    expect(screen.getByText(/保留上次成功数据/)).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });
  it('creates OAuth session and submits callback without exposing verifier', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/oauth/complete')) return Response.json({ account });
      if (url.endsWith('/oauth'))
        return Response.json({
          session: {
            id: 'session',
            url: 'https://auth.openai.com/oauth/authorize?state=public',
            expiresAt: Date.now() + 600000,
          },
        });
      return Response.json({ accounts: [] });
    });
    vi.stubGlobal('fetch', fetcher);
    render(
      <SubscriptionsClient
        catalog={buildSubscriptionCatalog(PROVIDER_PRESETS)}
      />
    );
    const user = userEvent.setup();
    expect(
      screen.getByRole('button', { name: '登录 GitHub Copilot' })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'xAI (Grok)（尚未开放）' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '登录 Codex' }).querySelector('img')
    ).toHaveAttribute('src', '/logos/openai.svg');
    expect(screen.queryByRole('button', { name: '登录 Gemini CLI' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录 Antigravity CLI' }).querySelector('img')).toHaveAttribute('src', '/subscriptions/antigravity.svg');
    await user.click(await screen.findByRole('button', { name: '登录 Codex' }));
    await user.click(screen.getByRole('button', { name: '生成授权链接' }));
    expect(
      await screen.findByRole('link', { name: '打开官方授权页' })
    ).toHaveAttribute('rel', 'noreferrer');
    await user.type(
      screen.getByLabelText('授权结果'),
      'http://localhost:1455/auth/callback?code=abc&state=public'
    );
    await user.click(screen.getByRole('button', { name: '完成登录' }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          ([url, init]) =>
            url.endsWith('/oauth/complete') &&
            JSON.parse(String(init?.body)).sessionId === 'session'
        )
      ).toBe(true)
    );
  });
  it('shows the Copilot device code and completes login by polling', async () => {
    let polls = 0;
    const copilotAccount = {
      ...account,
      id: 'c',
      vendor: 'copilot',
      displayName: 'octo',
      quota: null,
      quotaError: null,
      providerId: 'p',
      providerSlug: 'oauth-copilot-c',
      modelCount: 2,
      modelsSyncedAt: Date.now(),
      modelsError: null,
    };
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/oauth/poll')) {
        polls++;
        return Response.json(
          polls === 1 ? { status: 'pending', retryAfterMs: 1000 } : { account: copilotAccount }
        );
      }
      if (url.endsWith('/oauth'))
        return Response.json({
          session: {
            id: 'device-session',
            kind: 'device',
            url: 'https://github.com/login/device',
            userCode: 'WDJB-MJHT',
            intervalMs: 1000,
            expiresAt: Date.now() + 900000,
          },
        });
      return Response.json({ accounts: [] });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<SubscriptionsClient catalog={buildSubscriptionCatalog(PROVIDER_PRESETS)} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '登录 GitHub Copilot' }));
    await user.click(screen.getByRole('button', { name: '获取设备码' }));
    expect(await screen.findByText('WDJB-MJHT')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开 GitHub 验证页' })).toHaveAttribute(
      'href',
      'https://github.com/login/device'
    );
    expect(screen.queryByLabelText('授权结果')).not.toBeInTheDocument();
    expect(await screen.findByText('octo', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(polls).toBe(2);
    expect(screen.getByText(/模型：2 个/)).toBeInTheDocument();
  }, 10000);
  it('re-syncs models and falls back to manual entry with the fetch error', async () => {
    const failed = {
      ...account,
      modelsError: '模型列表拉取失败：上游拒绝请求',
      modelsSyncedAt: null,
      modelCount: 0,
    };
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/a/models'))
        return Response.json(
          { error: '模型列表拉取失败：上游拒绝请求', account: failed },
          { status: 502 }
        );
      return Response.json({ accounts: [failed] });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<SubscriptionsClient catalog={buildSubscriptionCatalog(PROVIDER_PRESETS)} />);
    const user = userEvent.setup();
    expect(await screen.findByText(/手动填写模型 ID/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '同步模型' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('上游拒绝请求');
    await user.click(screen.getByRole('button', { name: '接入网关' }));
    expect(screen.getByLabelText('模型 ID')).toBeInTheDocument();
    expect(screen.getAllByText(/模型列表拉取失败：上游拒绝请求/).length).toBeGreaterThan(2);
  });
  it('requires explicit model ids to connect gateway', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        accounts: [account],
        account: { ...account, providerId: 'p', providerSlug: 'oauth-codex-a' },
      })
    );
    vi.stubGlobal('fetch', fetcher);
    render(
      <SubscriptionsClient
        catalog={buildSubscriptionCatalog(PROVIDER_PRESETS)}
      />
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '接入网关' }));
    expect(screen.getByRole('button', { name: '保存接入' })).toBeDisabled();
    await user.type(
      screen.getByLabelText('模型 ID'),
      'my-model\nmy-other-model'
    );
    await user.click(screen.getByRole('button', { name: '保存接入' }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some((args: unknown[]) =>
          String(args[0]).endsWith('/a/gateway')
        )
      ).toBe(true)
    );
  });
});

it('manages linked subscription models in a lazily loaded sheet', async () => {
  const linked = {
    ...account,
    quotaError: null,
    providerId: 'p',
    providerSlug: 'oauth-codex-a',
    modelCount: 2,
    modelsSyncedAt: Date.now(),
    modelsError: null,
  };
  let models = [
    {
      id: 'm1',
      modelId: 'gemini-3.1-pro',
      displayName: 'Gemini 3.1 Pro',
      alias: null,
      enabled: true,
      synced: true,
      reasoning: {
        control: 'level',
        variants: { low: 'gemini-3.1-pro-low', high: 'gemini-pro-agent' },
        upstreamDefault: 'gemini-pro-agent',
      },
    },
    { id: 'm2', modelId: 'manual-model', displayName: null, alias: null, enabled: true, synced: false, reasoning: null },
  ];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/a/models') && (!init?.method || init.method === 'GET'))
      return Response.json({ models });
    if (url.endsWith('/a/models/m1') && init?.method === 'PATCH') {
      models = models.map((m) => (m.id === 'm1' ? { ...m, ...JSON.parse(String(init.body)) } : m));
      return Response.json({ model: models[0] });
    }
    return Response.json({ accounts: [linked] });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<SubscriptionsClient catalog={buildSubscriptionCatalog(PROVIDER_PRESETS)} />);
  const user = userEvent.setup();
  expect(await screen.findByText('demo@example.com')).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([u]) => String(u).endsWith('/a/models'))).toBe(false);
  await user.click(screen.getByRole('button', { name: '管理模型（2）' }));
  expect(await screen.findByText('gemini-3.1-pro')).toBeInTheDocument();
  expect(screen.getByText('low')).toBeInTheDocument();
  expect(screen.getByText('high')).toHaveClass('font-semibold');
  expect(screen.getByText('手动添加')).toBeInTheDocument();
  await user.click(screen.getByRole('switch', { name: '启用 gemini-3.1-pro' }));
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(
        ([u, i]) => String(u).endsWith('/a/models/m1') && i?.method === 'PATCH' && JSON.parse(String(i.body)).enabled === false
      )
    ).toBe(true)
  );
  await user.click(screen.getByRole('button', { name: '编辑 gemini-3.1-pro 别名' }));
  await user.type(screen.getByLabelText('gemini-3.1-pro 的别名'), 'pro');
  await user.click(screen.getByRole('button', { name: '保存别名' }));
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(([, i]) => i?.method === 'PATCH' && JSON.parse(String(i.body)).alias === 'pro')
    ).toBe(true)
  );
});
