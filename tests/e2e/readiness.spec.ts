import { expect, test } from '@playwright/test';

test('M0 readiness module loads without page errors or failed assets', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '똥침각 · Poke & Panic' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('570점');
  await expect(page.getByText('게임 플레이는 아직 구현되지 않았습니다.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
