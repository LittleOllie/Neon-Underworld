import { test, expect } from '@playwright/test';
import { login, gotoGame } from './helpers';

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  expect(overflow).toBe(false);
}

test.describe('Mobile responsive core loop', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile nav, scout, produce, shop, empire', async ({ page }) => {
    await login(page);

    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await gotoGame(page, '/scout');
    await expect(page.getByRole('heading', { name: 'Scout' })).toBeVisible();
    await page.getByRole('option').first().click();
    await page.getByLabel('Turns to scout').fill('5');
    await page.getByRole('button', { name: 'Scout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 15000 });
    await assertNoHorizontalOverflow(page);

    await gotoGame(page, '/produce');
    await page.getByLabel('Turns to produce').fill('5');
    await page.getByRole('button', { name: 'Produce', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Production Complete' })).toBeVisible({ timeout: 15000 });
    await assertNoHorizontalOverflow(page);

    await gotoGame(page, '/shop');
    await page.getByRole('button', { name: 'Buy', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Purchase Complete' })).toBeVisible({ timeout: 15000 });
    await assertNoHorizontalOverflow(page);

    await gotoGame(page, '/empire');
    await expect(page.getByText('Happiness').first()).toBeVisible();
    await expect(page.getByText('Armed').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('Desktop shell', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('desktop navigation and home layout', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Scout' }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
