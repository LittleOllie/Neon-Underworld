import { test, expect } from '@playwright/test';
import {
  login,
  loginAs,
  gotoGame,
  headerCashLocator,
  headerTurnsLocator,
  headerPlayerLine,
  purchaseViaSupplyOrder,
  ensureTravelRides,
  parseMoney,
  parseTurnsUsed,
  assertNoStuckLoading,
  dismissBootScreen,
  dismissDevOverlay,
  PVP_BUYER_EMAIL,
  PVP_BUYER_PASSWORD,
} from './helpers';
import { ensurePass4E2EFixtures } from './pass4-setup';

test.describe('Pass 4 — core gameplay flows', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(() => {
    ensurePass4E2EFixtures();
  });

  test('shop purchase updates header cash immediately', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/shop');

    const cashBefore = parseMoney(await headerCashLocator(page).textContent());
    await purchaseViaSupplyOrder(page, { tab: 'Supplies', itemLabel: /Quantity of Rations/i, quantity: '1' });

    const cashAfter = parseMoney(await headerCashLocator(page).textContent());
    expect(cashAfter).toBeLessThan(cashBefore);
    await assertNoStuckLoading(page);
  });

  test('rapid buy clicks do not overspend (pending guard)', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/shop');
    await page.getByRole('button', { name: 'Supplies' }).click();

    const cashBefore = parseMoney(await headerCashLocator(page).textContent());
    await page.getByLabel(/Quantity of Rations/i).fill('1');
    const lineTotal = parseMoney(
      (await page.locator('.g-shop-controls .g-shop-total').first().textContent())?.match(/\$([\d,]+)/)?.[0] ??
        '0',
    );
    await page.locator('.g-shop-controls').getByRole('button', { name: 'Add to order' }).first().click();
    await page.getByRole('button', { name: 'Review' }).click();
    const checkoutBtn = page.getByRole('button', { name: 'BUY EVERYTHING' });
    await checkoutBtn.click({ clickCount: 2, delay: 0 });
    await expect(page.getByRole('heading', { name: 'Purchase Complete' })).toBeVisible({
      timeout: 15_000,
    });

    const cashAfterOne = parseMoney(await headerCashLocator(page).textContent());
    expect(cashAfterOne).toBeLessThan(cashBefore);
    expect(cashBefore - cashAfterOne).toBe(lineTotal);
    await assertNoStuckLoading(page);
  });

  test('produce completes and header turns reconcile', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/produce');

    const turnsBefore = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    await page.getByLabel('Turns to run').fill('3');
    await page.getByRole('button', { name: /^Run .+ · \d[\d,]* turns?$/ }).click();
    await expect(page.getByRole('heading', { name: 'Operations Complete' })).toBeVisible({
      timeout: 15_000,
    });

    const turnsAfter = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    expect(turnsAfter).toBeLessThan(turnsBefore);
    await assertNoStuckLoading(page);
  });

  test('travel updates header city without leaving travel page', async ({ page }) => {
    await login(page);
    await ensureTravelRides(page);
    await gotoGame(page, '/travel');

    const playerLine = headerPlayerLine(page);
    const beforeLine = (await playerLine.textContent()) ?? '';

    const travelBtn = page.getByRole('button', { name: 'Travel', exact: true, disabled: false }).first();
    await travelBtn.click();

    await expect(page.getByRole('heading', { name: 'Travel Complete' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/travel/);

    const afterLine = (await playerLine.textContent()) ?? '';
    expect(afterLine).not.toBe(beforeLine);
    expect(afterLine.length).toBeGreaterThan(0);
    await assertNoStuckLoading(page);
  });

  test('market listing and second-account bid', async ({ browser }) => {
    const seller = await browser.newPage();
    const buyer = await browser.newPage();

    await login(seller);
    await loginAs(buyer, PVP_BUYER_EMAIL, PVP_BUYER_PASSWORD);

    await gotoGame(seller, '/market');
    await seller.getByRole('tab', { name: 'Sell Item' }).click();

    const listBtn = seller.getByRole('button', { name: /List Item/i });
    if (!(await listBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Seller has no tradable inventory for market list E2E');
    }

    await seller.getByLabel('Quantity').fill('1');
    const openingBid = seller.getByLabel('Opening bid (total for lot)');
    await openingBid.fill('13');
    await dismissDevOverlay(seller);
    await listBtn.scrollIntoViewIfNeeded();
    await listBtn.click();
    await expect(seller.getByText(/Listed .+ on the Market/i)).toBeVisible({ timeout: 20_000 });

    await gotoGame(buyer, '/market');
    const listing = buyer
      .locator('.g-listing-card')
      .filter({ hasText: 'Seller: HermaNFT' })
      .filter({ hasText: 'Starting: $13' })
      .last();
    await expect(listing).toBeVisible({ timeout: 15_000 });
    const bidBtn = listing.getByRole('button', { name: 'Place bid' });
    await expect(bidBtn).toBeEnabled();
    const cashBeforeBid = parseMoney(await headerCashLocator(buyer).textContent());
    await bidBtn.click();
    await expect
      .poll(async () => parseMoney(await headerCashLocator(buyer).textContent()))
      .toBeLessThan(cashBeforeBid);

    await assertNoStuckLoading(seller);
    await assertNoStuckLoading(buyer);

    await seller.close();
    await buyer.close();
  });

  test('market browse tabs render without overflow', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/market');
    await expect(page.getByRole('heading', { name: 'Market' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
    await assertNoStuckLoading(page);
  });
});
