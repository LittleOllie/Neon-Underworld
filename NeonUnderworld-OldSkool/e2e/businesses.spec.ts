import { test, expect } from '@playwright/test';
import { login, gotoGame, ensureGameReady } from './helpers';

test.describe('Businesses', () => {
  test.setTimeout(90_000);

  test('page loads with NU terminology and no horizontal overflow', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/businesses');
    await ensureGameReady(page);

    await expect(page.getByRole('heading', { name: 'Businesses' })).toBeVisible();
    await expect(page.getByText(/\bTrace\b/i).first()).toBeVisible({ timeout: 10_000 });

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
});

test.describe('Businesses — mobile 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('acquire panel usable without horizontal overflow', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/businesses');
    await ensureGameReady(page);

    await expect(page.getByRole('heading', { name: 'Businesses' })).toBeVisible();

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
});
