import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { login, gotoGame } from './helpers';

async function openTargetWithIntel(page: Page) {
  const targetButton = page
    .getByRole('button', { name: /View Intel \/ Attack|Select Target/i })
    .first();
  await expect(targetButton).toBeVisible({ timeout: 15_000 });
  await targetButton.click();

  const gatherIntel = page.getByRole('button', { name: /Gather Intel/i });
  if (await gatherIntel.isVisible().catch(() => false)) {
    await gatherIntel.click();
    await expect(page.getByRole('listbox', { name: 'Attack type' })).toBeVisible({
      timeout: 20_000,
    });
    return;
  }

  await expect(page.getByRole('listbox', { name: 'Attack type' })).toBeVisible({
    timeout: 10_000,
  });
}

test.describe('Attack v1 — empty state', () => {
  test.beforeAll(() => {
    execSync('npx tsx scripts/e2e-clear-intel.ts', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
      env: process.env,
    });
  });

  test('attack page shows target list or empty guidance', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/attack');
    await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();
    const hasTargets = await page
      .getByRole('button', { name: /Select Target|View Intel \/ Attack/i })
      .first()
      .isVisible()
      .catch(() => false);
    const emptyGuidance = page.getByText(/No attackable players|Gather Basic Intel/i);
    if (!hasTargets) {
      await expect(emptyGuidance.first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Rankings' })).toBeVisible();
    }
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

  test('attack result returns to targets; report persists in Reports', async ({ page }) => {
    await login(page);

    await gotoGame(page, '/attack');
    await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();

    await openTargetWithIntel(page);

    await page
      .getByRole('listbox', { name: 'Attack type' })
      .getByRole('option', { name: /Home Invasion/i })
      .click();
    await page.getByLabel('Thugs to send').fill('10');
    await page.getByRole('button', { name: 'Attack', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Attack' }).click();

    await expect(page.getByText(/turns used/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('link', { name: 'Attack Again' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back to Targets' })).toBeVisible();

    await page.getByRole('button', { name: 'Back to Targets' }).click();
    await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();

    await gotoGame(page, '/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Attack Report —/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Attack v1 — mobile flow', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(() => {
    execSync('npx tsx scripts/e2e-combat-setup.ts', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
      env: process.env,
    });
  });

  test('mobile attack path is usable end-to-end', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/attack');
    await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);

    await openTargetWithIntel(page);

    await expect(page.getByRole('listbox', { name: 'Attack type' })).toBeVisible();
    await expect(page.getByLabel('Thugs to send')).toBeVisible();
    await expect(page.getByText(/Rides required/i)).toBeVisible();

    await page
      .getByRole('listbox', { name: 'Attack type' })
      .getByRole('option', { name: /Home Invasion/i })
      .click();
    await page.getByLabel('Thugs to send').fill('10');
    const attackButton = page.getByRole('button', { name: 'Attack', exact: true });
    await expect(attackButton).toBeEnabled({ timeout: 10_000 });
    await attackButton.click();
    await expect(page.getByRole('button', { name: 'Confirm Attack' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Attack' }).click();

    await expect(page.getByText(/turns used/i)).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Back to Targets' }).click();
    await expect(page.getByRole('heading', { name: 'Attack' })).toBeVisible();
  });
});
