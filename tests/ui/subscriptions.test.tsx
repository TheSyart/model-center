import { PROVIDER_PRESETS } from '@/lib/presets';
import { buildSubscriptionCatalog } from '@/lib/subscriptions/catalog';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelTable from '@/app/(admin)/providers/model-table';
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
      screen.getByRole('button', { name: 'GitHub Copilot（尚未开放）' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'xAI (Grok)（尚未开放）' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '登录 Codex' }).querySelector('img')
    ).toHaveAttribute('src', '/logos/openai.svg');
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

it('subscription model management does not show API prices or pricing restoration', () => {
  render(
    <ModelTable
      subscription
      providerId="p"
      models={[
        {
          id: 'm',
          provider_id: 'p',
          model_id: 'example-model',
          alias: null,
          display_name: null,
          enabled: true,
          input_price: 100,
          output_price: 200,
          cache_read_price: null,
          cache_write_price: null,
          pricing_source: 'auto',
          pricing_source_ref: null,
          pricing_synced_at: null,
          context_window: null,
          synced: false,
        },
      ]}
      onChanged={() => {}}
      onToast={() => {}}
    />
  );
  expect(screen.queryByText('四档单价（$/M tokens）')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '恢复定价' })
  ).not.toBeInTheDocument();
  expect(screen.getByText(/订阅成本未知/)).toBeInTheDocument();
});
