import { test, expect } from '@playwright/test';

const PROTECTED_ROUTES = ['/market', '/cartels', '/travel', '/bank', '/command', '/scout'];

test.describe('Protected routes — unauthenticated redirect', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to login when unauthenticated`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  }
});

test.describe('Playtest route — dev guard', () => {
  test('/playtest/turns requires authentication', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/playtest/turns');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
