import { test, expect } from '@playwright/test';

test('subscription login has a real server session, secure cookie and cancellable dialog', async ({
  page,
}) => {
  await page.goto('/subscriptions');
  await expect(
    page.getByRole('heading', { name: '订阅账号', exact: true })
  ).toBeVisible();
  await expect(page.getByText('添加你的第一个订阅账号')).toBeVisible();
  await page.getByRole('button', { name: '登录 Codex', exact: true }).click();
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/admin/subscriptions/oauth') &&
      r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: '生成授权链接' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.session.url).toMatch(
    /^https:\/\/auth.openai.com\/oauth\/authorize\?/
  );
  expect(JSON.stringify(body)).not.toMatch(/verifier|refreshToken|accessToken/);
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === 'mc_subscription_owner'
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Strict');
  await expect(
    page.getByRole('link', { name: '打开官方授权页' })
  ).toBeVisible();
  const cancelled = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/oauth/${body.session.id}`) &&
      r.request().method() === 'DELETE'
  );
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect((await cancelled).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('quota cards and gateway form remain usable on mobile and desktop', async ({
  page,
}, info) => {
  const now = Date.now();
  const accounts = [
    {
      id: 'claude-demo',
      vendor: 'claude',
      displayName: 'claude-demo@example.com',
      email: 'claude-demo@example.com',
      enabled: true,
      authStatus: 'ready',
      expiresAt: now + 3600000,
      projectId: null,
      lastError: null,
      quotaError: null,
      quotaAttemptedAt: now,
      providerId: 'demo-p',
      providerSlug: 'oauth-claude-demo',
      quota: {
        checkedAt: now,
        plan: 'Max',
        windows: [
          {
            id: 'five',
            label: '5 小时',
            remainingPercent: 72,
            usedPercent: 28,
            resetAt: now + 7200000,
            modelId: null,
            windowSeconds: 18000,
          },
          {
            id: 'week',
            label: '每周',
            remainingPercent: 38,
            usedPercent: 62,
            resetAt: now + 86400000,
            modelId: null,
            windowSeconds: 604800,
          },
        ],
      },
    },
    {
      id: 'codex-demo',
      vendor: 'codex',
      displayName: 'codex-demo@example.com',
      email: 'codex-demo@example.com',
      enabled: true,
      authStatus: 'ready',
      expiresAt: now + 3600000,
      projectId: null,
      lastError: null,
      quotaError: '额度查询失败，请稍后重试',
      quotaAttemptedAt: now,
      providerId: null,
      providerSlug: null,
      quota: {
        checkedAt: now - 600000,
        plan: 'Plus',
        windows: [
          {
            id: 'five',
            label: '5 小时',
            remainingPercent: 0,
            usedPercent: 100,
            resetAt: now + 3600000,
            modelId: null,
            windowSeconds: 18000,
          },
          {
            id: 'week',
            label: '每周',
            remainingPercent: null,
            usedPercent: null,
            resetAt: null,
            modelId: null,
            windowSeconds: null,
          },
        ],
      },
    },
    {
      id: 'gemini-demo',
      vendor: 'gemini',
      displayName: 'gemini-demo@example.com',
      email: 'gemini-demo@example.com',
      enabled: false,
      authStatus: 'needs_reauth',
      expiresAt: now - 60000,
      projectId: 'sample-cloud-project',
      lastError: '登录已失效，请重新授权',
      quotaError: null,
      quotaAttemptedAt: null,
      providerId: null,
      providerSlug: null,
      quota: null,
    },
  ];
  await page.route('**/api/admin/subscriptions', (route) =>
    route.fulfill({ json: { accounts } })
  );
  await page.goto('/subscriptions');
  await expect(page.getByText('剩余 72%')).toBeVisible();
  await expect(page.getByText('剩余 0%')).toBeVisible();
  await expect(page.getByText('剩余额度未知')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('subscriptions.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '接入网关', exact: true })
    .first()
    .click();
  await expect(page.getByLabel('模型 ID')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存接入' })).toBeDisabled();
  await page.getByLabel('模型 ID').fill('model-user-confirmed');
  await expect(page.getByRole('button', { name: '保存接入' })).toBeEnabled();
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) => el.scrollWidth <= el.clientWidth)
  ).toBe(true);
});
