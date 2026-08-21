import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  loginAs,
  gotoGame,
  gotoPath,
  dismissBootScreen,
  headerTurnsLocator,
  parseTurnsUsed,
  purchaseViaSupplyOrder,
  FRESH_E2E_EMAIL,
  FRESH_E2E_PASSWORD,
} from './helpers';

const REPO_ROOT = path.resolve(__dirname, '../..');

function seedFreshPlayer() {
  execSync('npm run db:seed:fresh-e2e', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  expect(overflow).toBe(false);
}

test.describe('Fresh player journey — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.setTimeout(120_000);
  test.beforeAll(() => seedFreshPlayer());

  test('canonical starter path without admin turn dependency', async ({ page }) => {
    await loginAs(page, FRESH_E2E_EMAIL, FRESH_E2E_PASSWORD);
    await dismissBootScreen(page);

    const startingTurns = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    expect(startingTurns).toBeGreaterThanOrEqual(400);

    await gotoGame(page, '/scout');
    await page.getByRole('button', { name: '25', exact: true }).click();
    await page.getByRole('button', { name: /^Scout .+ · \d[\d,]* turns?$/ }).click();
    await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 30_000 });

    await gotoGame(page, '/shop');
    await page.getByRole('button', { name: 'Supplies' }).click();
    await purchaseViaSupplyOrder(page, { itemLabel: /Quantity of Rations/i, quantity: '1' });

    await gotoGame(page, '/scout');
    await page.getByRole('button', { name: '25', exact: true }).click();
    await page.getByRole('button', { name: /^Scout .+ · \d[\d,]* turns?$/ }).click();
    await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 30_000 });

    await gotoGame(page, '/produce');
    await page.getByRole('button', { name: '25', exact: true }).click();
    await page.getByRole('button', { name: /^Run .+ · \d[\d,]* turns?$/ }).click();
    await expect(page.getByRole('heading', { name: 'Operations Complete' })).toBeVisible({
      timeout: 15_000,
    });

    await gotoGame(page, '/empire');
    await expect(page.getByText('Influence', { exact: true })).toBeVisible();

    await gotoGame(page, '/rankings');
    await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible();

    await gotoGame(page, '/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    await gotoGame(page, '/cartels');
    await expect(page.getByRole('button', { name: 'Create Faction' })).toBeVisible();

    await gotoGame(page, '/market');
    await expect(page.getByRole('tab', { name: 'Browse' })).toBeVisible();

    await gotoGame(page, '/businesses');
    await expect(page.getByRole('heading', { name: 'Businesses' })).toBeVisible();
  });
});

test.describe('Fresh player journey — mobile 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeAll(() => seedFreshPlayer());

  test('scout and nav without horizontal overflow', async ({ page }) => {
    await loginAs(page, FRESH_E2E_EMAIL, FRESH_E2E_PASSWORD);
    await dismissBootScreen(page);
    await gotoGame(page, '/scout');
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', { name: '25', exact: true }).click();
    await page.getByRole('button', { name: /^Scout .+ · \d[\d,]* turns?$/ }).click();
    await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 30_000 });
    await assertNoHorizontalOverflow(page);
  });
});
