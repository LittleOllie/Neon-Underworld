import { test, expect } from '@playwright/test';
import { login, gotoGame, dismissBootScreen, assertNoStuckLoading } from './helpers';

const SLOW_NAV_DELAY_MS = 900;

/** Delay RSC/document responses so navigation stays pending past thresholds. */
async function delayRoute(page: import('@playwright/test').Page, pathPattern: RegExp) {
  await page.route(pathPattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SLOW_NAV_DELAY_MS));
    await route.continue();
  });
}

test.describe('Navigation transition / network loader', () => {
  test('fast navigation does not leave stuck overlay', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await gotoGame(page, '/command');
    await page.getByRole('navigation').getByRole('link', { name: 'Scout', exact: true }).click();
    await expect(page).toHaveURL(/\/scout/, { timeout: 15_000 });
    await expect(page.locator('.g-nav-network-overlay')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('.g-main-transition.is-pending')).toHaveCount(0, { timeout: 5_000 });
    await assertNoStuckLoading(page);
  });

  test('slow navigation shows full network overlay with route message', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await gotoGame(page, '/command');
    await delayRoute(page, /\/market(\?|$)/);

    await page.getByRole('button', { name: 'More menu' }).click();
    await page.getByRole('link', { name: 'Market', exact: true }).click();

    await expect(page.locator('.g-nav-network-overlay')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('CONNECTING TO MARKET...')).toBeVisible();
    await expect(page.locator('.g-nav-network-loader__logo')).toBeVisible();

    await expect(page).toHaveURL(/\/market/, { timeout: 20_000 });
    await expect(page.locator('.g-nav-network-overlay')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('.g-main-transition.is-pending')).toHaveCount(0, { timeout: 5_000 });
    await assertNoStuckLoading(page);
  });

  test('slow navigation shows subtle indicator before full overlay', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await gotoGame(page, '/command');
    await delayRoute(page, /\/shop(\?|$)/);

    await page.getByRole('navigation').getByRole('link', { name: 'Shop', exact: true }).click();

    await expect(page.locator('.g-nav-progress.is-loading')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.g-main-transition.is-pending')).toBeVisible();

    await expect(page).toHaveURL(/\/shop/, { timeout: 20_000 });
    await expect(page.locator('.g-nav-subtle-indicator')).toHaveCount(0, { timeout: 5_000 });
    await assertNoStuckLoading(page);
  });

  test('route messages for scout and cartels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await login(page);
    await gotoGame(page, '/command');

    await delayRoute(page, /\/scout(\?|$)/);
    await page.getByRole('navigation').getByRole('link', { name: 'Scout', exact: true }).click();
    await expect(page.getByText('OPENING INTEL...')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/scout/, { timeout: 20_000 });
    await expect(page.locator('.g-nav-network-overlay')).toHaveCount(0, { timeout: 5_000 });

    await gotoGame(page, '/command');
    await delayRoute(page, /\/cartels(\?|$)/);
    await page.getByRole('button', { name: 'More menu' }).click();
    await page.getByRole('link', { name: 'Factions', exact: true }).click();
    await expect(page.getByText('ENTERING FACTIONS...')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/cartels/, { timeout: 20_000 });
    await assertNoStuckLoading(page);
  });

  test('back navigation clears overlay', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await gotoGame(page, '/shop');
    await page.goBack();
    await expect(page).toHaveURL(/\/command/, { timeout: 10_000 });
    await dismissBootScreen(page);
    await expect(page.locator('.g-nav-network-overlay')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('.g-main-transition.is-pending')).toHaveCount(0, { timeout: 5_000 });
  });
});
