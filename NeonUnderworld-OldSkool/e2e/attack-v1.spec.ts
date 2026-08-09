import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminChangeMe123!';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Enter District Network/i }).click();
  await expect(page).toHaveURL(/\/command/, { timeout: 15000 });
}

test.describe('Attack v1 — empty state', () => {
  test.beforeAll(() => {
    execSync('npx tsx scripts/e2e-clear-intel.ts', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
      env: process.env,
    });
  });

  test('attack page without intel shows rankings prompt', async ({ page }) => {
    await login(page);
    await page.goto('/attack');
    await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View Rankings' })).toBeVisible();
  });

  test('rankings links from nav', async ({ page }) => {
    await login(page);
    await page.goto('/command');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Rankings' }).click();
    await expect(page).toHaveURL(/\/rankings/);
  });
});

test.describe('Attack v1 — Home Invasion flow', () => {
  test.beforeAll(() => {
    execSync('npx tsx scripts/e2e-combat-setup.ts', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
      env: process.env,
    });
  });

  test('attack result returns to target; report persists in Reports', async ({ page }) => {
    await login(page);

    await page.goto('/attack');
    await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();
    await expect(page.getByLabel('Target')).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Attack type').selectOption('HOME_INVASION');
    await page.getByLabel('Thugs to send').fill('10');
    await page.getByRole('button', { name: 'Attack', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Attack' }).click();

    await expect(page.getByRole('heading', { name: /Attack/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/turns used/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'View Report' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Attack Again' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to Target' })).toBeVisible();

    await page.getByRole('link', { name: 'Back to Target' }).click();
    await expect(page).toHaveURL(/\/players\//);

    await page.goto('/reports?filter=COMBAT');
    await expect(page.getByText(/Attack Report/i).first()).toBeVisible({ timeout: 10000 });
  });
});
