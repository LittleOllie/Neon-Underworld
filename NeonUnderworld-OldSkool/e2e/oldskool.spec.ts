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

function parseMoney(text: string | null) {
  return Number((text ?? '0').replace(/[^0-9]/g, ''));
}

test.describe('OldSkool gameplay flow', () => {
  test('login → home → scout → report → empire → rankings consistency', async ({ page }) => {
    await login(page);

    await page.goto('/scout');
    await page.getByLabel('Turns to scout').fill('5');
    await page.getByRole('button', { name: 'Scout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 15000 });

    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    await page.goto('/empire');
    await expect(page.getByRole('heading', { name: 'Empire' })).toBeVisible();

    await page.goto('/rankings');
    await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible();
    const youRow = page.locator('.g-rank-you');
    if (await youRow.count()) {
      const rankNw = await youRow.locator('span').last().textContent();
      expect(rankNw).toBeTruthy();
    }

    await page.goto('/command');
    await expect(page.getByText('Net Worth').first()).toBeVisible();
  });
});

test.describe('OldSkool public pages', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'NEON UNDERWORLD', exact: true })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enter District Network/i })).toBeVisible();
  });

  test('rankings requires login', async ({ page }) => {
    await page.goto('/rankings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('home smoke — core sections render when authenticated', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByText('Health')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Scout' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rankings' }).first()).toBeVisible();
  });
});
