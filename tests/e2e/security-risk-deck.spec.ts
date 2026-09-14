import { expect, test } from '@playwright/test';

test('standalone deck supports deterministic keyboard and hash navigation', async ({ page, baseURL }) => {
  const consoleErrors: string[] = [];
  const unexpectedRequests: string[] = [];
  const expectedOrigin = new URL(baseURL!).origin;
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== expectedOrigin) unexpectedRequests.push(request.url());
  });

  await page.goto('/security-risk-deck.html');
  const currentSlide = page.locator('.slide[aria-hidden="false"]');
  const slideStatus = page.locator('#slide-status');
  await expect(currentSlide).toHaveAttribute('data-screen-label', /^01 /);
  await expect(slideStatus).toContainText('第 1 页，共 11 页');

  await page.keyboard.press('ArrowRight');
  await expect(currentSlide).toHaveAttribute('data-screen-label', /^02 /);
  await expect(slideStatus).toContainText('第 2 页，共 11 页');
  await expect(page).toHaveURL(/#slide-2$/);

  await page.keyboard.press(' ');
  await expect(currentSlide).toHaveAttribute('data-screen-label', /^03 /);
  await page.keyboard.press('Home');
  await expect(currentSlide).toHaveAttribute('data-screen-label', /^01 /);
  await page.keyboard.press('End');
  await expect(currentSlide).toHaveAttribute('data-screen-label', /^11 /);
  await page.keyboard.press('ArrowRight');
  await expect(currentSlide).toHaveAttribute('data-screen-label', /^11 /);

  await page.goto('/security-risk-deck.html#slide-6');
  await expect(currentSlide).toHaveAttribute('data-screen-label', /^06 /);
  await page.reload();
  await expect(currentSlide).toHaveAttribute('data-screen-label', /^06 /);

  await expect(page.locator('nav')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(0);
  await page.goto('/security-risk-deck.html#slide-5');
  await expect(page.getByRole('link', { name: /进入.*演示/ })).toHaveCount(0);
  expect(unexpectedRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('standalone deck fills common recording viewports without blank letterbox areas', async ({ page }) => {
  await page.goto('/security-risk-deck.html');

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const box = await page.locator('.stage').boundingBox();
      return box?.width ?? 0;
    }).toBeLessThanOrEqual(viewport.width + 1);
    const metrics = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      vertical: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      stageWidth: document.querySelector<HTMLElement>('.stage')?.getBoundingClientRect().width ?? 0,
      stageHeight: document.querySelector<HTMLElement>('.stage')?.getBoundingClientRect().height ?? 0,
      backdropWidth: document.querySelector<HTMLElement>('.ambient-backdrop')?.getBoundingClientRect().width ?? 0,
      backdropHeight: document.querySelector<HTMLElement>('.ambient-backdrop')?.getBoundingClientRect().height ?? 0,
      backdropImage: getComputedStyle(document.querySelector<HTMLElement>('.ambient-backdrop')!).backgroundImage,
    }));
    expect(metrics.horizontal, `${viewport.width}x${viewport.height} horizontal overflow`).toBe(false);
    expect(metrics.vertical, `${viewport.width}x${viewport.height} vertical overflow`).toBe(false);
    expect(metrics.stageWidth).toBeGreaterThan(0);
    expect(metrics.stageHeight).toBeGreaterThan(0);
    expect(metrics.stageWidth).toBeLessThanOrEqual(viewport.width + 1);
    expect(metrics.stageHeight).toBeLessThanOrEqual(viewport.height + 1);
    expect(metrics.backdropWidth).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(metrics.backdropHeight).toBeGreaterThanOrEqual(viewport.height - 1);
    expect(metrics.backdropImage).not.toBe('none');
  }
});

test('standalone deck keeps every slide visual-led and presentation-copy concise', async ({ page }) => {
  await page.goto('/security-risk-deck.html#slide-1');

  for (let slideNumber = 1; slideNumber <= 11; slideNumber += 1) {
    await page.goto(`/security-risk-deck.html#slide-${slideNumber}`);
    const slide = page.locator('.slide[aria-hidden="false"]');
    const stage = page.locator('.stage');
    const visual = slide.locator('.visual-anchor');

    await expect(visual, `slide ${slideNumber} must have a primary visual`).toBeVisible();

    const [stageBox, visualBox, visibleCopy, visualBackground] = await Promise.all([
      stage.boundingBox(),
      visual.boundingBox(),
      slide.evaluate((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim()),
      visual.evaluate((element) => getComputedStyle(element).backgroundImage),
    ]);

    expect(stageBox, `slide ${slideNumber} stage box`).not.toBeNull();
    expect(visualBox, `slide ${slideNumber} visual box`).not.toBeNull();
    expect(
      visualBox!.width,
      `slide ${slideNumber} primary illustration should span the canvas width`,
    ).toBeGreaterThanOrEqual(stageBox!.width * 0.98);
    expect(
      visualBox!.height,
      `slide ${slideNumber} primary illustration should span the canvas height`,
    ).toBeGreaterThanOrEqual(stageBox!.height * 0.98);
    expect(
      visualBackground,
      `slide ${slideNumber} primary illustration must resolve to an embedded image`,
    ).not.toBe('none');
    expect(
      visibleCopy.length,
      `slide ${slideNumber} should leave detailed explanation to narration`,
    ).toBeLessThanOrEqual(150);
  }
});

test('comparison and evidence labels stay below the title safe area', async ({ page }) => {
  await page.goto('/security-risk-deck.html#slide-3');

  for (const slideNumber of [10]) {
    await page.goto(`/security-risk-deck.html#slide-${slideNumber}`);
    const slide = page.locator('.slide[aria-hidden="false"]');
    const title = slide.locator('.slide-title');
    const labels = slide.locator('[data-safe-label]');
    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();
    await expect(labels.first()).toBeVisible();

    for (let index = 0; index < await labels.count(); index += 1) {
      const labelBox = await labels.nth(index).boundingBox();
      expect(labelBox).not.toBeNull();
      expect(labelBox!.y).toBeGreaterThanOrEqual(titleBox!.y + titleBox!.height + 12);
    }
  }
});

test('every slide keeps text overlays inside the canvas without collisions', async ({ page }) => {
  const textOverlaySelector = [
    '.eyebrow', '.slide-title', '.cover-copy h1', '.cover-copy p', '.cover-key',
    '.scene-label', '.story-label', '.compare-block', '.compare-center span',
    '.analogy-note', '.mechanism-row span', '.bottom-claim', '.agent-flow',
    '.data-types span', '.pipeline', '.evidence-block', '.reference-link',
    '.closing-copy h2', '.closing-copy p', '.closing-actions span', '.closing-line',
  ].join(',');

  for (let slideNumber = 1; slideNumber <= 11; slideNumber += 1) {
    await page.goto(`/security-risk-deck.html#slide-${slideNumber}`);
    const audit = await page.locator('.slide[aria-hidden="false"]').evaluate((slide, selector) => {
      const stage = document.querySelector<HTMLElement>('.stage')!.getBoundingClientRect();
      const overlays = [...slide.querySelectorAll<HTMLElement>(selector)].map((element) => {
        const box = element.getBoundingClientRect();
        return {
          label: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
          left: box.left, top: box.top, right: box.right, bottom: box.bottom,
        };
      });
      const outside = overlays.filter((box) => (
        box.left < stage.left - 1 || box.top < stage.top - 1
        || box.right > stage.right + 1 || box.bottom > stage.bottom + 1
      ));
      const collisions: string[] = [];
      for (let first = 0; first < overlays.length; first += 1) {
        for (let second = first + 1; second < overlays.length; second += 1) {
          const a = overlays[first];
          const b = overlays[second];
          const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapWidth > 2 && overlapHeight > 2) collisions.push(`${a.label} <> ${b.label}`);
        }
      }
      return { outside, collisions };
    }, textOverlaySelector);

    expect(audit.outside, `slide ${slideNumber} text outside canvas`).toEqual([]);
    expect(audit.collisions, `slide ${slideNumber} overlapping text`).toEqual([]);
  }
});

test('reviewed captions align with the illustration label zones', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const boxes = async (slideNumber: number, selector: string) => {
    await page.goto(`/security-risk-deck.html#slide-${slideNumber}`);
    return page.locator(`.slide[aria-hidden="false"] ${selector}`).evaluateAll((elements) => (
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          centerX: box.left + box.width / 2,
          centerY: box.top + box.height / 2,
          background: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
        };
      })
    ));
  };

  const slide4 = await boxes(4, '.mechanism-row span');
  expect(slide4).toHaveLength(5);
  expect(Math.min(...slide4.map((box) => box.top))).toBeGreaterThanOrEqual(790);
  expect(Math.max(...slide4.map((box) => box.bottom))).toBeLessThanOrEqual(880);
  const assertCentersInside = (
    actual: Array<{ centerX: number; centerY: number; background: string; borderTopWidth: string }>,
    targets: Array<{ left: number; top: number; right: number; bottom: number }>,
  ) => {
    expect(actual).toHaveLength(targets.length);
    actual.forEach((box, index) => {
      const target = targets[index];
      expect(box.centerX).toBeGreaterThan(target.left);
      expect(box.centerX).toBeLessThan(target.right);
      expect(box.centerY).toBeGreaterThan(target.top);
      expect(box.centerY).toBeLessThan(target.bottom);
      expect(box.background).toBe('rgba(0, 0, 0, 0)');
      expect(box.borderTopWidth).toBe('0px');
    });
  };

  assertCentersInside(await boxes(5, '.story-label'), [
    { left: 55, top: 925, right: 535, bottom: 1045 },
    { left: 660, top: 925, right: 1200, bottom: 1045 },
    { left: 1325, top: 925, right: 1865, bottom: 1045 },
  ]);
  assertCentersInside(await boxes(6, '.story-label'), [
    { left: 45, top: 850, right: 615, bottom: 1040 },
    { left: 670, top: 850, right: 1235, bottom: 1040 },
    { left: 1290, top: 850, right: 1870, bottom: 1040 },
  ]);

  const slide8 = await boxes(8, '.covert-row');
  expect(slide8).toHaveLength(1);
  expect(slide8[0].bottom).toBeGreaterThanOrEqual(1000);

  assertCentersInside(await boxes(9, '.pipeline strong'), [
    { left: 175, top: 895, right: 475, bottom: 1035 },
    { left: 610, top: 895, right: 895, bottom: 1035 },
    { left: 1090, top: 895, right: 1370, bottom: 1035 },
    { left: 1560, top: 895, right: 1900, bottom: 1035 },
  ]);
  assertCentersInside(await boxes(11, '.closing-actions span'), [
    { left: 275, top: 900, right: 650, bottom: 1045 },
    { left: 850, top: 900, right: 1210, bottom: 1045 },
    { left: 1400, top: 900, right: 1800, bottom: 1045 },
  ]);
});
