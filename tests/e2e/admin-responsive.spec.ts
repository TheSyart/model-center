import { expect, test } from '@playwright/test';

const pages = ['/', '/providers', '/aliases', '/prompts', '/tokens', '/logs', '/security-lab', '/settings'];

test('all admin modules render without page-level horizontal overflow', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  for (const path of pages) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    if (path === '/security-lab') await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `${path} has horizontal overflow`).toBe(false);
  }

  expect(consoleErrors).toEqual([]);
});

test('theme selection persists', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: /界面主题/ }).click();
  await page.getByRole('menuitem', { name: /深色/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('mobile navigation and filter sheet are keyboard-operable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-375');
  await page.goto('/');
  await page.getByRole('button', { name: '打开导航' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: /筛选用量范围/ }).click();
  await expect(page.getByRole('dialog', { name: '筛选用量' })).toBeVisible();
});
