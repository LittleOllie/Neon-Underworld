import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { login, gotoGame } from './helpers';

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
    await gotoGame(page, '/attack');
    await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rankings' })).toBeVisible();
  });

  test('rankings links from nav', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/rankings');
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

    await gotoGame(page, '/attack');
    await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();
    const openTarget = page.getByRole('button', { name: /View Intel \/ Attack/i }).first();
    if (await openTarget.isVisible().catch(() => false)) {
      await openTarget.click();
    }
    await expect(page.getByRole('listbox', { name: 'Attack type' })).toBeVisible({ timeout: 10_000 });

    await page
      .getByRole('listbox', { name: 'Attack type' })
      .getByRole('option', { name: /Home Invasion/i })
      .click();
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

    await gotoGame(page, '/reports?filter=COMBAT');
    await expect(page.getByText(/Attack Report/i).first()).toBeVisible({ timeout: 10000 });
  });
});
