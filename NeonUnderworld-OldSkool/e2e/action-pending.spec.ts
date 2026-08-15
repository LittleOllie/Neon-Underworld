import { test, expect } from '@playwright/test';
import {
  login,
  gotoGame,
  headerTurnsLocator,
  catalogBuyButton,
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
    await page.getByLabel('Turns to produce').fill('3');
    const produceBtn = page.getByRole('button', { name: 'Produce', exact: true });
    await produceBtn.click({ clickCount: 2, delay: 0 });
    await expect(page.getByRole('heading', { name: 'Production Complete' })).toBeVisible({
      timeout: 20_000,
    });

    const turnsAfter = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    expect(turnsBefore - turnsAfter).toBe(3);
    await assertNoStuckLoading(page);
  });

  test('shop blocks cross-item purchase while pending', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/shop');

    const buyButtons = page.locator('.g-shop-controls').getByRole('button', { name: 'Buy', exact: true });
    const firstBuy = buyButtons.first();
    const secondBuy = buyButtons.nth(1);

    await firstBuy.click();
    await expect.poll(async () => firstBuy.isDisabled(), { timeout: 3_000 }).toBe(true);
    await expect(secondBuy).toBeDisabled();
    await expect(page.getByRole('button', { name: /Buying/i }).first()).toBeVisible();

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

    const buyBtn = catalogBuyButton(page);
    await dismissDevOverlay(page);
    await buyBtn.click();

    await expect(buyBtn).toBeEnabled({ timeout: 10_000 });
    await assertNoStuckLoading(page);
  });
});
