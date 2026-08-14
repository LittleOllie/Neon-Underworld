import { test, expect } from '@playwright/test';
import { login, gotoGame, dismissBootScreen, headerTurnsLocator, parseTurnsUsed } from './helpers';

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  expect(overflow).toBe(false);
}

test.describe('Onboarding polish — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('fresh-player-shaped path with scout result CTAs and produce default', async ({ page }) => {
    await login(page);
    await dismissBootScreen(page);

    await expect(page.getByText(/Cap 5,000/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    const turnsBefore = parseTurnsUsed(await headerTurnsLocator(page).textContent());

    await gotoGame(page, '/scout');
    await expect(page.getByRole('group', { name: 'Quick turn amounts' })).toBeVisible();
    const scoutAmount = Math.min(25, Math.max(0, turnsBefore));
    if (scoutAmount >= 25) {
      await page.getByRole('button', { name: '25', exact: true }).click();
    } else if (scoutAmount > 0) {
      await page.getByLabel('Turns to scout').fill(String(scoutAmount));
    }
    if (scoutAmount > 0) {
      await expect(page.getByLabel('Turns to scout')).toHaveValue(String(scoutAmount));
      await page.getByRole('button', { name: /^Scout .+\?$/ }).click();
      await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 30000 });
      const scoutResult = page.locator('main');
      await expect(scoutResult.getByRole('link', { name: 'Shop' })).toBeVisible();
      await expect(scoutResult.getByRole('link', { name: 'Produce' })).toBeVisible();
      await expect(scoutResult.getByRole('link', { name: 'Home' })).toBeVisible();

      await scoutResult.getByRole('link', { name: 'Shop' }).click();
      await expect(page.getByRole('heading', { name: 'Shop' })).toBeVisible();
    }

    await gotoGame(page, '/scout');
    const turnsMid = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    const secondScout = Math.min(50, Math.max(0, turnsMid));
    if (secondScout >= 50) {
      await page.getByRole('button', { name: '50', exact: true }).click();
      await expect(page.getByLabel('Turns to scout')).toHaveValue('50');
    } else if (secondScout > 0) {
      await page.getByLabel('Turns to scout').fill(String(secondScout));
      await expect(page.getByLabel('Turns to scout')).toHaveValue(String(secondScout));
    }

    await gotoGame(page, '/produce');
    await expect(page.getByLabel('Turns to produce')).toHaveValue('25');
    await expect(page.getByRole('group', { name: 'Quick turn amounts' })).toBeVisible();
    const produceTurns = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    const produceAmount = Math.min(100, Math.max(0, produceTurns));
    if (produceAmount >= 100) {
      await page.getByRole('button', { name: '100', exact: true }).click();
      await expect(page.getByLabel('Turns to produce')).toHaveValue('100');
    } else if (produceAmount > 0) {
      await page.getByLabel('Turns to produce').fill(String(Math.min(25, produceAmount)));
    }
    if (produceAmount > 0) {
      await page.getByRole('button', { name: 'Produce', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Production Complete' })).toBeVisible({
        timeout: 15000,
      });
    }

    await gotoGame(page, '/empire');
    await expect(page.getByText(/Your empire's overall value/i)).toBeVisible();

    await gotoGame(page, '/rankings');
    await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible();

    await page.getByRole('button', { name: 'More menu' }).click();
    await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();
  });
});

test.describe('Onboarding polish — mobile 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('scout and produce quick amounts without horizontal overflow', async ({ page }) => {
    await login(page);
    await dismissBootScreen(page);

    await gotoGame(page, '/scout');
    await expect(page.getByRole('group', { name: 'Quick turn amounts' })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    const mobileTurns = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    const mobileScout = Math.min(25, Math.max(0, mobileTurns));
    if (mobileScout >= 25) {
      await page.getByRole('button', { name: '25', exact: true }).click();
    } else if (mobileScout > 0) {
      await page.getByLabel('Turns to scout').fill(String(mobileScout));
    }
    if (mobileScout > 0) {
      await page.getByRole('button', { name: /^Scout .+\?$/ }).click();
      await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 30000 });
      await assertNoHorizontalOverflow(page);
      await expect(page.locator('main').getByRole('link', { name: 'Shop' })).toBeVisible();
    }

    await gotoGame(page, '/produce');
    await expect(page.getByLabel('Turns to produce')).toHaveValue('25');
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', { name: '250', exact: true }).click();
    await expect(page.getByLabel('Turns to produce')).toHaveValue('250');
    await assertNoHorizontalOverflow(page);
  });
});
