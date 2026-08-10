import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Empire Phase 2 flow', () => {
  test('payout update on empire page', async ({ page }) => {
    await login(page);

    await page.goto('/empire');
    await expect(page.getByRole('heading', { name: 'Empire' })).toBeVisible();
    await page.getByRole('button', { name: 'Increase payout' }).click();
    await page.getByRole('button', { name: 'Save Payout' }).click();
    await expect(page.getByText(/Payout updated/i)).toBeVisible({ timeout: 10000 });
  });

  test('empire page renders flat sections', async ({ page }) => {
    await login(page);
    await page.goto('/empire');
    await expect(page.getByText('Happiness').first()).toBeVisible();
    await expect(page.getByText('Armed').first()).toBeVisible();
  });

  test('bank route redirects away from player UI', async ({ page }) => {
    await login(page);
    await page.goto('/bank');
    await expect(page).toHaveURL(/\/command/);
  });
});
