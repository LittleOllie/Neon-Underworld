import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminChangeMe123!';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Enter District Network/i }).click();
  await expect(page).toHaveURL(/\/command/, { timeout: 15000 });
}

test.describe('Core loop — Scout, Produce, City Shop', () => {
  test('shop owned/total, scout numeric input, produce numeric input', async ({ page }) => {
    await login(page);

    await page.goto('/shop');
    await expect(page.getByRole('heading', { name: 'Shop' })).toBeVisible();
    await expect(page.getByText(/Owned:/).first()).toBeVisible();

    const shopMain = page.locator('main');
    await expect(shopMain.getByText('Worker', { exact: true })).toHaveCount(0);

    await page.getByLabel(/Quantity of/i).first().fill('1');
    await expect(page.getByText(/Total:/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Buy', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Purchase Complete' })).toBeVisible({ timeout: 15000 });

    await page.goto('/scout');
    await expect(page.getByRole('heading', { name: 'Scout' })).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Turns to scout').fill('25');
    await page.getByRole('button', { name: 'Scout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 15000 });
    const turnsStatus = page.locator('.g-status-item').filter({ hasText: 'Turns' });
    await expect(turnsStatus).toBeVisible();
    const turnsAfterScout = await turnsStatus.textContent();
    expect(turnsAfterScout).toMatch(/\d[\d,]*\s*\/\s*[\d,]+/);
    expect(turnsAfterScout).not.toMatch(/K/i);

    await page.goto('/produce');
    await expect(page.getByRole('heading', { name: 'Produce' })).toBeVisible();
    await page.getByLabel('Turns to produce').fill('100');
    await page.getByRole('button', { name: 'Produce', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Production Complete' })).toBeVisible({ timeout: 15000 });

    await page.goto('/command');
    await expect(page.getByText('Net Worth').first()).toBeVisible();
    await page.goto('/rankings');
    await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible();
  });
});

test.describe('Home vs Empire separation', () => {
  test('home is lightweight; empire has management detail', async ({ page }) => {
    await login(page);

    await page.goto('/command');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByText('Health')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Scout' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rankings' }).first()).toBeVisible();

    const homeMain = page.locator('main');
    await expect(homeMain.locator('.g-label', { hasText: 'Payout' })).toHaveCount(0);
    await expect(homeMain.locator('.g-label', { hasText: 'Supplies' })).toHaveCount(0);
    await expect(homeMain.locator('.g-label', { hasText: 'Armed' })).toHaveCount(0);

    await page.goto('/empire');
    await expect(page.getByRole('heading', { name: 'Empire' })).toBeVisible();
    await expect(page.locator('.g-label', { hasText: 'Payout' })).toBeVisible();
    await expect(page.locator('.g-label', { hasText: 'Armed' })).toBeVisible();
    await expect(page.getByText('GEAR')).toBeVisible();
  });
});
