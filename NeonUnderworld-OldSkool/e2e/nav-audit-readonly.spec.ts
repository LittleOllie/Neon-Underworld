/**
 * READ-ONLY navigation audit — Reports, Rankings, More menu, back/forward.
 * Diagnostic only; does not modify app code.
 */
import { test, expect } from '@playwright/test';
import { login, gotoGame, dismissBootScreen, assertNoStuckLoading } from './helpers';

test.describe('Nav audit — reports detail', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('report tap navigates to detail without stuck overlays', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 15_000 });

    const firstReport = page.locator('.g-inbox-item').first();
    if (!(await firstReport.isVisible().catch(() => false))) {
      test.skip(true, 'No reports in inbox for audit');
    }

    await firstReport.click();
    await expect(page).toHaveURL(/\/reports\/[^/]+$/, { timeout: 15_000 });
    await expect(page.locator('.g-main-transition.is-pending')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('.g-more-overlay')).toHaveCount(0);
    await expect(page.locator('.nu-boot')).toHaveCount(0);
    await assertNoStuckLoading(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/reports/, { timeout: 10_000 });
    await expect(page.locator('.g-more-overlay')).toHaveCount(0);
  });
});

test.describe('Nav audit — rankings to profile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('rankings player link opens profile in-app', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/rankings');
    await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible({ timeout: 15_000 });

    const profileLink = page.locator('.g-rank-link').first();
    if (!(await profileLink.isVisible().catch(() => false))) {
      test.skip(true, 'No other players on rankings');
    }

    await profileLink.click();
    await expect(page).toHaveURL(/\/players\//, { timeout: 15_000 });
    await expect(page.locator('.g-main-transition.is-pending')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('.g-more-overlay')).toHaveCount(0);
    await assertNoStuckLoading(page);
  });
});

test.describe('Nav audit — More menu', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('More menu closes and route loads', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'More menu' }).click();
    await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();

    await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: /^Reports/ }).click();
    await expect(page.locator('.g-more-overlay')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByRole('dialog', { name: 'More' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/reports/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  });
});

test.describe('Nav audit — boot deep link', () => {
  test('hard load /reports preserves route after boot', async ({ page }) => {
    await login(page);
    await page.evaluate(() => sessionStorage.removeItem('nu-boot-dismissed'));

    await page.goto('/reports');
    await dismissBootScreen(page);
    await expect(page).toHaveURL(/\/reports/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 15_000 });

    await gotoGame(page, '/rankings');
    await expect(page.locator('.nu-boot')).toHaveCount(0);
  });
});
