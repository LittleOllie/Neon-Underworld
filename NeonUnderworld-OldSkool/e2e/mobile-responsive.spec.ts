import { test, expect } from '@playwright/test';
import { login, gotoGame, empireSection, purchaseViaSupplyOrder } from './helpers';

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

    const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(mobileNav).toBeVisible();
    for (const label of ['Home', 'Empire', 'Scout', 'Operations', 'Shop']) {
      await expect(mobileNav.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    await expect(mobileNav.getByRole('button', { name: 'More menu' })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await mobileNav.getByRole('link', { name: 'Shop', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shop' })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await gotoGame(page, '/rankings');
    await expect(mobileNav.getByRole('button', { name: 'More menu' })).toHaveClass(/g-nav-active/);
    const rivalLink = page.locator('.g-rank-link').first();
    if (await rivalLink.isVisible().catch(() => false)) {
      await rivalLink.click();
      await expect(page.locator('.g-shell--nu-scene')).toBeVisible();
      await expect(page.locator('.g-intel-chrome')).toBeVisible();
    }
    await assertNoHorizontalOverflow(page);

    await gotoGame(page, '/scout');
    await expect(page.getByRole('heading', { name: 'Scout' })).toBeVisible();
    await page.getByLabel('Turns to scout').fill('5');
    await page.getByRole('button', { name: /^Scout .+ · \d[\d,]* turns?$/ }).click();
    await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 15000 });
    await assertNoHorizontalOverflow(page);

    await gotoGame(page, '/produce');
    await page.getByLabel('Turns to run').fill('5');
    await page.getByRole('button', { name: /^Run .+ · \d[\d,]* turns?$/ }).click();
    await expect(page.getByRole('heading', { name: 'Operations Complete' })).toBeVisible({ timeout: 15000 });
    await assertNoHorizontalOverflow(page);

    await gotoGame(page, '/shop');
    await page.getByRole('button', { name: 'Supplies' }).click();
    await purchaseViaSupplyOrder(page, { itemLabel: /Quantity of Rations/i, quantity: '1' });
    await assertNoHorizontalOverflow(page);

    await gotoGame(page, '/empire');
    await expect(page.getByLabel('Your empire')).toBeVisible();
    await empireSection(page, 'SPECIALISTS').locator('summary').click();
    await expect(page.getByText('Morale').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('narrow phone width 375×667 — nav and overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);

    const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(mobileNav.getByRole('link', { name: 'Shop', exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await gotoGame(page, '/attack');
    await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();
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
