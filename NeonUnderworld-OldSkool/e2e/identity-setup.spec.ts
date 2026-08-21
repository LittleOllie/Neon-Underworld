import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, dismissBootScreen } from './helpers';

test.describe('Operator identity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await dismissBootScreen(page);
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page).toHaveURL(/\/command/, { timeout: 20_000 });
    await dismissBootScreen(page);
  });

  test('settings shows identity section with change link', async ({ page }) => {
    await page.goto('/settings');
    await dismissBootScreen(page);
    await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Change your identity' })).toBeVisible();
    await expect(page.getByText(/visible to other Operators/i)).toBeVisible();
  });

  test('identity editor loads without horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/identity/select?from=settings');
    await dismissBootScreen(page);
    await expect(page.getByRole('heading', { name: /CHANGE YOUR IDENTITY|CHOOSE YOUR IDENTITY/i })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});
