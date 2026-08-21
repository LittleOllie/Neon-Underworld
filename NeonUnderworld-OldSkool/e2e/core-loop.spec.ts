import { test, expect } from '@playwright/test';
import { login, gotoGame, gotoPath, empireSection, purchaseViaSupplyOrder } from './helpers';

test.describe('Core loop — Scout, Operations, City Shop', () => {
  test.setTimeout(120_000);

  test('shop owned/total, scout numeric input, operations numeric input', async ({ page }) => {
    await login(page);

    await gotoGame(page, '/shop');
    await expect(page.getByRole('heading', { name: 'Shop' })).toBeVisible();
    await expect(page.getByText(/Owned:/).first()).toBeVisible();

    const shopMain = page.locator('main');
    await expect(shopMain.getByText('Worker', { exact: true })).toHaveCount(0);

    await purchaseViaSupplyOrder(page, { tab: 'Supplies', itemLabel: /Quantity of Rations/i, quantity: '1' });

    await gotoGame(page, '/scout');
    await expect(page.getByRole('heading', { name: 'Scout' })).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Turns to scout').fill('25');
    await page.getByRole('button', { name: /^Scout .+ · \d[\d,]* turns?$/ }).click();
    await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 15000 });
    const turnsStatus = page.locator('.g-status-item').filter({ hasText: 'Turns' });
    await expect(turnsStatus).toBeVisible();
    const turnsAfterScout = await turnsStatus.textContent();
    expect(turnsAfterScout).toMatch(/\d[\d,]*\s*\/\s*[\d,]+/);
    expect(turnsAfterScout).not.toMatch(/K/i);

    await gotoGame(page, '/produce');
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
    await page.getByLabel('Turns to run').fill('100');
    await page.getByRole('button', { name: /^Run .+ · \d[\d,]* turns?$/ }).click();
    await expect(page.getByRole('heading', { name: 'Operations Complete' })).toBeVisible({ timeout: 15000 });

    await gotoGame(page, '/command');
    await expect(page.getByText('Influence').first()).toBeVisible();
    await gotoGame(page, '/rankings');
    await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible();
  });
});

test.describe('Home vs Empire separation', () => {
  test.setTimeout(120_000);

  test('home is lightweight; empire has management detail', async ({ page }) => {
    await login(page);

    await gotoGame(page, '/command');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByText('Health')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Scout' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rankings' }).first()).toBeVisible();

    const homeMain = page.locator('main');
    await expect(homeMain.locator('.g-label', { hasText: 'Payout' })).toHaveCount(0);
    await expect(homeMain.locator('.g-label', { hasText: 'Supplies' })).toHaveCount(0);
    await expect(homeMain.locator('.g-label', { hasText: 'Armed' })).toHaveCount(0);

    await gotoGame(page, '/empire');
    await expect(page.getByRole('heading', { name: 'Empire' })).toBeVisible();
    await expect(page.getByLabel('Your empire')).toBeVisible();
    await empireSection(page, 'SPECIALISTS').locator('summary').click();
    await expect(page.getByText('Specialist payout')).toBeVisible();
    await empireSection(page, 'ENFORCERS').locator('summary').click();
    await expect(page.locator('.g-label', { hasText: 'Armed' })).toBeVisible();
    await expect(empireSection(page, 'GEAR')).toHaveCount(1);
  });
});
