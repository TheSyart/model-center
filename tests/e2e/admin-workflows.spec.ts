import { expect, test } from '@playwright/test';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
});

test('dashboard filters update the persisted query', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '时间范围' }).click();
  await page.getByRole('option', { name: '近 7 天' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('range')).toBe('7d');
});

test('provider creation opens a focus-managed wide sheet', async ({ page }) => {
  await page.goto('/providers');
  await page.getByRole('button', { name: /新建服务商/ }).first().click();
  await expect(page.getByRole('dialog', { name: '新建服务商' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '新建服务商' })).toContainText('模型将在创建后自动同步');
});

test('alias targets expose explicit failover reordering', async ({ page }) => {
  await page.goto('/aliases');
  await page.getByRole('button', { name: /新建别名/ }).first().click();
  await page.getByRole('button', { name: /添加目标/ }).click();
  await page.getByRole('button', { name: /添加目标/ }).click();
  await expect(page.getByText('优先级 1')).toBeVisible();
  await expect(page.getByText('优先级 2')).toBeVisible();
  await page.getByRole('button', { name: '上移第 2 个目标' }).click();
});

test('prompt editor detects variables and renders preview values', async ({ page }) => {
  await page.goto('/prompts');
  await page.getByRole('button', { name: /新建提示词/ }).first().click();
  await page.getByLabel('内容（支持 {{变量}} 占位）').fill('请使用 {{language}} 输出');
  await page.getByRole('textbox', { name: 'language 的预览值' }).fill('中文');
  await expect(page.getByText('请使用 中文 输出')).toBeVisible();
});

test('token creation displays the one-time secret result dialog', async ({ page }) => {
  await page.goto('/tokens');
  await page.getByRole('button', { name: /新建令牌/ }).click();
  await page.getByLabel('名称').fill(`e2e-${Date.now()}`);
  await page.getByRole('button', { name: '创建令牌' }).click();
  await expect(page.getByRole('dialog', { name: '令牌创建成功' })).toBeVisible();
  await expect(page.getByRole('button', { name: '复制密钥' })).toBeVisible();
});

test('logs filters preserve pagination semantics', async ({ page }) => {
  await page.route('**/api/admin/logs?**', async (route) => {
    const currentPage = Number(new URL(route.request().url()).searchParams.get('page'));
    await route.fulfill({ json: { logs: [], total: 60, page: currentPage, page_size: 50 } });
  });
  await page.goto('/logs');
  await expect(page.getByText('1 / 2')).toBeVisible();
  const nextResponse = page.waitForRequest((request) => request.url().includes('/api/admin/logs?') && new URL(request.url()).searchParams.get('page') === '2');
  await page.getByRole('button', { name: '下一页' }).click();
  await nextResponse;
  await expect(page.getByText('2 / 2')).toBeVisible();
});

test('settings exposes a clear failed-save state', async ({ page }) => {
  await page.route('**/api/admin/settings', async (route) => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 500, json: { error: '测试保存失败' } });
    else await route.continue();
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: '保存' }).first().click();
  await expect(page.getByText('测试保存失败')).toBeVisible();
});
