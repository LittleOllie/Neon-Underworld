import { test, expect } from '@playwright/test';
import {
  login,
  gotoGame,
  headerTurnsLocator,
  purchaseViaSupplyOrder,
  ensureMinTurns,
  parseTurnsUsed,
  assertNoStuckLoading,
  dismissDevOverlay,
} from './helpers';

test.describe('Action pending / double-submit protection', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('scout double-click submits once', async ({ page }) => {
    await login(page);
    await ensureMinTurns(page, 50);
    await gotoGame(page, '/scout');

    const turnsBefore = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    const scoutBtn = page.getByRole('button', { name: /Scout/i }).first();
    await scoutBtn.click({ clickCount: 2, delay: 0 });
    await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({
      timeout: 20_000,
    });

    const turnsAfter = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    expect(turnsBefore - turnsAfter).toBeGreaterThan(0);
    await assertNoStuckLoading(page);
  });

  test('produce double-click submits once', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/produce');

    const turnsBefore = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    await page.getByLabel('Turns to run').fill('3');
    const produceBtn = page.getByRole('button', { name: /^Run .+ · \d[\d,]* turns?$/ });
    await produceBtn.click({ clickCount: 2, delay: 0 });
    await expect(page.getByRole('heading', { name: 'Operations Complete' })).toBeVisible({
      timeout: 20_000,
    });

    const turnsAfter = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    expect(turnsBefore - turnsAfter).toBe(3);
    await assertNoStuckLoading(page);
  });

  test('shop blocks cross-item purchase while pending', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/shop');
    await page.getByRole('button', { name: 'Supplies' }).click();

    await page.getByLabel(/Quantity of Rations/i).fill('1');
    await page.locator('.g-shop-controls').getByRole('button', { name: 'Add to order' }).first().click();
    await page.getByRole('button', { name: 'Review' }).click();
    const checkoutBtn = page.getByRole('button', { name: 'BUY EVERYTHING' });
    await checkoutBtn.click();
    await expect.poll(async () => checkoutBtn.isDisabled(), { timeout: 3_000 }).toBe(true);
    await expect(page.getByRole('button', { name: /PROCESSING ORDER/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Purchase Complete' })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoStuckLoading(page);
  });

  test('scout locks controls while request is in flight', async ({ page }) => {
    await login(page);
    await ensureMinTurns(page, 50);
    await gotoGame(page, '/scout');

    const scoutBtn = page.getByRole('button', { name: /Scout/i }).first();
    const turnsInput = page.getByLabel('Turns to scout');
    const quick25 = page.getByRole('button', { name: '25', exact: true });

    await scoutBtn.click();
    await expect.poll(async () => scoutBtn.isDisabled(), { timeout: 3_000 }).toBe(true);
    await expect(page.getByRole('button', { name: /Scouting/i })).toBeVisible();
    await expect(turnsInput).toBeDisabled();
    await expect(quick25).toBeDisabled();

    await expect(page.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoStuckLoading(page);
  });

  test('shop failure recovery unlocks controls', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/shop');

    let failOnce = true;
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (failOnce && request.method() === 'POST' && request.headers()['next-action']) {
        failOnce = false;
        await route.fulfill({ status: 500, contentType: 'text/plain', body: 'Simulated failure' });
        return;
      }
      await route.continue();
    });

    await page.getByRole('button', { name: 'Supplies' }).click();
    await page.getByLabel(/Quantity of Rations/i).fill('1');
    await page.locator('.g-shop-controls').getByRole('button', { name: 'Add to order' }).first().click();
    await page.getByRole('button', { name: 'Review' }).click();
    const checkoutBtn = page.getByRole('button', { name: 'BUY EVERYTHING' });
    await dismissDevOverlay(page);
    await checkoutBtn.click();
    await expect(checkoutBtn).toBeEnabled({ timeout: 10_000 });
    await assertNoStuckLoading(page);
  });
});
