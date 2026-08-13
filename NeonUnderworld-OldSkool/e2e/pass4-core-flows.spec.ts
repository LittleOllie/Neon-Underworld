import { test, expect } from '@playwright/test';
import {
  login,
  loginAs,
  gotoGame,
  headerCashLocator,
  headerTurnsLocator,
  headerPlayerLine,
  catalogBuyButton,
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
    await catalogBuyButton(page).click();
    await expect(page.getByRole('heading', { name: 'Purchase Complete' })).toBeVisible({
      timeout: 15_000,
    });

    const cashAfter = parseMoney(await headerCashLocator(page).textContent());
    expect(cashAfter).toBeLessThan(cashBefore);
    await assertNoStuckLoading(page);
  });

  test('rapid buy clicks do not overspend (pending guard)', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/shop');

    const cashBefore = parseMoney(await headerCashLocator(page).textContent());
    const buyBtn = catalogBuyButton(page);
    const totalText = await page.locator('.g-shop-controls .g-shop-total').first().textContent();
    const unitCost = parseMoney(totalText?.match(/\$([\d,]+)/)?.[0] ?? '0');

    await buyBtn.click({ clickCount: 2, delay: 0 });
    await expect(page.getByRole('heading', { name: 'Purchase Complete' })).toBeVisible({
      timeout: 15_000,
    });

    const cashAfterOne = parseMoney(await headerCashLocator(page).textContent());
    expect(cashAfterOne).toBeLessThan(cashBefore);
    expect(cashBefore - cashAfterOne).toBe(unitCost);

    await page.getByRole('button', { name: 'Shop Again', exact: true }).click();
    const cashBeforeSecond = parseMoney(await headerCashLocator(page).textContent());
    await catalogBuyButton(page).click();
    await expect(page.getByRole('heading', { name: 'Purchase Complete' })).toBeVisible({
      timeout: 15_000,
    });
    const cashAfterTwo = parseMoney(await headerCashLocator(page).textContent());
    expect(cashBeforeSecond - cashAfterTwo).toBeGreaterThan(0);
    await assertNoStuckLoading(page);
  });

  test('produce completes and header turns reconcile', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/produce');

    const turnsBefore = parseTurnsUsed(await headerTurnsLocator(page).textContent());
    await page.getByLabel('Turns to produce').fill('3');
    await page.getByRole('button', { name: 'Produce', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Production Complete' })).toBeVisible({
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
