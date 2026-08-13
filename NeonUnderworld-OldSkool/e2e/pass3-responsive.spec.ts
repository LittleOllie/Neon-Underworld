import { test, expect, type Locator, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { login, gotoGame } from './helpers';

const MOBILE_WIDTHS = [375, 390, 430] as const;

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  expect(overflow).toBe(false);
}

async function assertReachable(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
}

for (const width of MOBILE_WIDTHS) {
  test.describe(`Pass 3 responsive — market @ ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });

    test('tabs, filters, listings, and sell form fit without overflow', async ({ page }) => {
      await login(page);
      await gotoGame(page, '/market');
      await expect(page.getByRole('heading', { name: 'Market' })).toBeVisible();
      await assertNoHorizontalOverflow(page);

      const tablist = page.getByRole('tablist');
      await expect(tablist.getByRole('tab', { name: 'Browse' })).toBeVisible();
      await expect(tablist.getByRole('tab', { name: 'Sell Item' })).toBeVisible();
      await expect(tablist.getByRole('tab', { name: 'My Auctions' })).toBeVisible();

      const filters = page.getByRole('group', { name: 'Market category' });
      await expect(filters.getByRole('button', { name: 'All' })).toBeVisible();
      await expect(filters.getByRole('button', { name: 'Weapons' })).toBeVisible();
      await assertNoHorizontalOverflow(page);

      await tablist.getByRole('tab', { name: 'Sell Item' }).click();
      await expect(page.getByLabel('Quantity')).toBeVisible();
      await expect(page.getByLabel('Opening bid (total for lot)')).toBeVisible();
      const listBtn = page.getByRole('button', { name: /List Item/i });
      await assertReachable(page, listBtn);
      await assertNoHorizontalOverflow(page);

      await tablist.getByRole('tab', { name: 'My Auctions' }).click();
      await assertNoHorizontalOverflow(page);
    });
  });
}

test.describe('Pass 3 responsive — attack with intel', () => {
  test.beforeAll(() => {
    execSync('npx tsx scripts/e2e-combat-setup.ts', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
      env: process.env,
    });
  });

  for (const width of MOBILE_WIDTHS) {
    test(`attack controls usable @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await login(page);
      await gotoGame(page, '/attack');
      await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();
      await assertNoHorizontalOverflow(page);

      const openTarget = page.getByRole('button', { name: /View Intel \/ Attack/i }).first();
      if (await openTarget.isVisible().catch(() => false)) {
        await openTarget.click();
        const attackTypes = page.getByRole('listbox', { name: 'Attack type' });
        await expect(attackTypes).toBeVisible({ timeout: 10_000 });
        await attackTypes.getByRole('option', { name: /Home Invasion/i }).click();
        await expect(attackTypes.getByRole('option', { name: /Home Invasion/i })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await expect(page.getByLabel('Thugs to send')).toBeVisible();
        const attackBtn = page.getByRole('button', { name: 'Attack', exact: true });
        await assertReachable(page, attackBtn);
        await assertNoHorizontalOverflow(page);
      } else {
        await expect(page.getByRole('link', { name: 'Rankings' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Travel' })).toBeVisible();
      }
    });
  }
});
