import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  login,
  loginAs,
  gotoGame,
  gotoPath,
  dismissBootScreen,
  headerCashLocator,
  parseMoney,
  dismissDevOverlay,
  ADMIN_EMAIL,
  PVP_BUYER_EMAIL,
  PVP_BUYER_PASSWORD,
} from './helpers';

const REPO_ROOT = path.resolve(__dirname, '../..');

function resetMarketSeller() {
  execSync('npx tsx scripts/e2e-market-seller-setup.ts', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

test.describe('Market listing sync', () => {
  test.setTimeout(120_000);

  test('create → Browse + My Auctions + nav + refresh', async ({ page }) => {
    resetMarketSeller();
    const listingPrice = 2000 + (Date.now() % 8000);
    const priceLabel = `$${listingPrice.toLocaleString()}`;

    await login(page);
    await dismissBootScreen(page);
    await gotoGame(page, '/market');

    await page.getByRole('tab', { name: 'Sell Item' }).click();
    const sellPanel = page.locator('main');
    await sellPanel.getByRole('combobox').first().selectOption('hash');
    await page.locator('#market-qty').fill('2');
    await page.locator('#market-price').fill(String(listingPrice));
    await dismissDevOverlay(page);
    await page.getByRole('button', { name: /List Item/i }).click();

    await expect(page.getByText(/Listed 2× Components on the Market/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: 'My Auctions' }).click();
    await expect(
      page
        .locator('.g-row')
        .filter({ hasText: 'Components × 2' })
        .filter({ hasText: new RegExp(`${priceLabel.replace('$', '\\$')} · ACTIVE`) })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: 'Browse' }).click();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    const browseCard = page
      .locator('.g-listing-card')
      .filter({ hasText: /Components × 2/i })
      .filter({ hasText: `Starting: ${priceLabel}` })
      .first();
    await expect(browseCard).toBeVisible({ timeout: 15_000 });

    await gotoGame(page, '/command');
    await gotoGame(page, '/market');
    await page.getByRole('tab', { name: 'My Auctions' }).click();
    await expect(
      page
        .locator('.g-row')
        .filter({ hasText: 'Components × 2' })
        .filter({ hasText: new RegExp(`${priceLabel.replace('$', '\\$')} · ACTIVE`) })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await gotoGame(page, '/market');
    await expect(page.getByRole('heading', { name: 'Market' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('tab', { name: 'My Auctions' }).click();
    await expect(
      page
        .locator('.g-row')
        .filter({ hasText: 'Components × 2' })
        .filter({ hasText: new RegExp(`${priceLabel.replace('$', '\\$')} · ACTIVE`) })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('bid updates seller My Auctions and bidder cash', async ({ browser }) => {
    resetMarketSeller();
    const listingPrice = 3000 + (Date.now() % 7000);
    const priceLabel = `$${listingPrice.toLocaleString()}`;

    const seller = await browser.newPage();
    const bidder = await browser.newPage();

    await login(seller);
    await loginAs(bidder, PVP_BUYER_EMAIL, PVP_BUYER_PASSWORD);

    await gotoGame(seller, '/market');
    await seller.getByRole('tab', { name: 'Sell Item' }).click();
    await seller.locator('main').getByRole('combobox').first().selectOption('hash');
    await seller.locator('#market-qty').fill('1');
    await seller.locator('#market-price').fill(String(listingPrice));
    await seller.getByRole('button', { name: /List Item/i }).click();
    await expect(seller.getByText(/Listed 1× Components on the Market/i)).toBeVisible({ timeout: 20_000 });

    await gotoGame(bidder, '/market');
    const listing = bidder
      .locator('.g-listing-card')
      .filter({ hasText: `Starting: ${priceLabel}` })
      .filter({ hasText: /Components × 1/i })
      .first();
    await expect(listing).toBeVisible({ timeout: 15_000 });

    const cashBefore = parseMoney(await headerCashLocator(bidder).textContent());
    await listing.getByRole('button', { name: 'Place bid' }).click();
    await expect
      .poll(async () => parseMoney(await headerCashLocator(bidder).textContent()))
      .toBeLessThan(cashBefore);

    await gotoGame(seller, '/market');
    await seller.getByRole('tab', { name: 'My Auctions' }).click();
    await expect(
      seller.locator('.g-row').filter({ hasText: 'Components × 1' }).filter({ hasText: /ACTIVE/i }).first(),
    ).toBeVisible();

    await seller.close();
    await bidder.close();
  });
});

test.describe('Market listing with heavy history', () => {
  test.setTimeout(120_000);

  test('fresh listing visible after 55 ended auctions', async ({ page }) => {
    execSync('npx tsx scripts/seed-market-history-fixture.ts', {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    });

    const listingPrice = 4500 + (Date.now() % 5000);
    const priceLabel = `$${listingPrice.toLocaleString()}`;

    await login(page);
    await gotoGame(page, '/market');
    await page.getByRole('tab', { name: 'Sell Item' }).click();
    await page.locator('main').getByRole('combobox').first().selectOption('hash');
    await page.locator('#market-qty').fill('1');
    await page.locator('#market-price').fill(String(listingPrice));
    await page.getByRole('button', { name: /List Item/i }).click();
    await expect(page.getByText(/Listed 1× Components on the Market/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: 'My Auctions' }).click();
    await expect(
      page
        .locator('.g-row')
        .filter({ hasText: 'Components × 1' })
        .filter({ hasText: new RegExp(`${priceLabel.replace('$', '\\$')} · ACTIVE`) })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    execSync('npx tsx scripts/e2e-market-seller-setup.ts', {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    });
  });
});
