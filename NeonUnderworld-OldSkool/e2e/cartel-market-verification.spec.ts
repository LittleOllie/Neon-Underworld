import { test, expect } from '@playwright/test';
import {
  login,
  loginAs,
  gotoGame,
  headerCashLocator,
  parseMoney,
  assertNoStuckLoading,
  dismissDevOverlay,
  ADMIN_EMAIL,
  PVP_BUYER_EMAIL,
  PVP_BUYER_PASSWORD,
  PVP_PLAYER_C_EMAIL,
  PVP_PLAYER_C_PASSWORD,
} from './helpers';
import { ensureCartelVerificationFixtures, fundCartelTreasury } from './cartel-verification-setup';

test.describe('Cartel + Market verification — three players', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240_000);

  const stamp = Date.now().toString(36).toUpperCase();
  const cartelName = `Verify Cartel ${stamp}`;
  const cartelTag = `V${stamp.slice(-4)}`;
  const listingPrice = 1000 + (Date.now() % 9000);
  const listingPriceLabel = `$${listingPrice.toLocaleString()}`;

  test.beforeAll(() => {
    ensureCartelVerificationFixtures();
  });

  test('full cartel membership, armoury, leadership, and market state sync', async ({ browser }) => {
    const playerA = await browser.newPage();
    const playerB = await browser.newPage();
    const playerC = await browser.newPage();

    await login(playerA);
    await loginAs(playerB, PVP_BUYER_EMAIL, PVP_BUYER_PASSWORD);
    await loginAs(playerC, PVP_PLAYER_C_EMAIL, PVP_PLAYER_C_PASSWORD);

    // Player A — create cartel
    await gotoGame(playerA, '/cartels');
    await playerA.getByRole('button', { name: 'Create Cartel' }).click();
    await playerA.getByPlaceholder('Cartel name').fill(cartelName);
    await playerA.getByPlaceholder('Tag (e.g. NS)').fill(cartelTag);
    await dismissDevOverlay(playerA);
    await playerA.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(playerA.getByText(new RegExp(`Cartel ${cartelName}`, 'i'))).toBeVisible({
      timeout: 20_000,
    });
    await expect(playerA.getByText(/Leader · Active/i)).toBeVisible();
    await expect(playerA.getByRole('button', { name: 'Send Invite' })).toBeVisible();

    fundCartelTreasury(cartelName, 50_000);

    // Player B — request to join
    await gotoGame(playerB, '/cartels');
    const cartelCard = playerB.locator('.g-listing-card').filter({ hasText: cartelName });
    await expect(cartelCard).toBeVisible({ timeout: 15_000 });
    await cartelCard.getByRole('button', { name: 'Request to Join' }).click();
    await expect(playerB.getByText('Request pending')).toBeVisible({ timeout: 15_000 });

    // Player A — accept B (navigate away/back so server page data includes the new request)
    await gotoGame(playerA, '/command');
    await gotoGame(playerA, '/cartels');
    const joinSection = playerA.locator('section[aria-label="Join requests"]');
    await expect(joinSection).toBeVisible({ timeout: 15_000 });
    await joinSection.getByRole('button', { name: 'Accept' }).click();
    await expect(playerA.getByText(/joined your cartel/i)).toBeVisible({ timeout: 20_000 });

    // Player B — membership via in-app navigation (no browser hard refresh)
    await gotoGame(playerB, '/command');
    await gotoGame(playerB, '/cartels');
    await expect(playerB.getByText(cartelName)).toBeVisible({ timeout: 15_000 });
    await expect(playerB.getByText(/Member · Active/i)).toBeVisible({ timeout: 15_000 });

    // Player A — invite C
    await playerA.getByPlaceholder('Player alias to invite').fill('RustRunner');
    await playerA.getByRole('button', { name: 'Send Invite' }).click();
    await expect(playerA.getByText(/Invite sent to RustRunner/i)).toBeVisible({ timeout: 15_000 });

    // Player C — accept invite
    await gotoGame(playerC, '/cartels');
    await expect(playerC.getByText(cartelName)).toBeVisible({ timeout: 15_000 });
    await playerC.getByRole('button', { name: 'Accept' }).click();
    await expect(playerC.getByText(/Member · Active/i)).toBeVisible({ timeout: 20_000 });

    // Armoury purchases by A
    await gotoGame(playerA, '/cartels');
    const treasurySection = playerA.locator('section[aria-label="Cartel treasury"]');
    const treasuryBefore = parseMoney(
      (await treasurySection.locator('.g-row').filter({ hasText: 'Cash balance' }).textContent()) ?? '0',
    );
    const forcesSection = playerA.locator('section[aria-label="Cartel forces"]');
    const thugsBefore = parseMoney(
      (await forcesSection.locator('.g-row').filter({ hasText: 'Cartel Thugs' }).textContent()) ?? '0',
    );

    const armourySection = playerA.locator('section[aria-label="Cartel armoury purchases"]');
    const thugRow = armourySection.locator('.g-cartel-armoury__row').filter({ hasText: 'Thug' }).first();
    await thugRow.getByRole('spinbutton').fill('2');
    await thugRow.getByRole('button', { name: /Buy \$1,400/i }).click();
    await expect(playerA.getByText(/Purchased 2 Cartel Thugs/i)).toBeVisible({ timeout: 20_000 });

    const glockRow = armourySection.locator('.g-cartel-armoury__row').filter({ hasText: 'Glock' }).first();
    await glockRow.getByRole('spinbutton').fill('1');
    await glockRow.getByRole('button', { name: /Buy \$500/i }).click();
    await expect(playerA.getByText(/Purchased 1 Glock/i)).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () =>
        parseMoney(
          (await treasurySection.locator('.g-row').filter({ hasText: 'Cash balance' }).textContent()) ??
            '0',
        ),
      )
      .toBeLessThan(treasuryBefore);

    await expect
      .poll(async () =>
        parseMoney(
          (await forcesSection.locator('.g-row').filter({ hasText: 'Cartel Thugs' }).textContent()) ??
            '0',
        ),
      )
      .toBeGreaterThan(thugsBefore);

    // Leadership transfer A → B
    await playerA
      .getByRole('combobox')
      .filter({ has: playerA.locator('option', { hasText: 'Transfer leadership to…' }) })
      .selectOption({ label: 'NeonViper' });
    await playerA.getByRole('button', { name: 'Transfer Leadership' }).click();
    await expect(playerA.getByText(/Leadership transferred to NeonViper/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(playerA.getByText(/Member · Active/i)).toBeVisible();
    await expect(playerA.getByRole('button', { name: 'Send Invite' })).toHaveCount(0);

    await playerB.reload();
    await dismissDevOverlay(playerB);
    await expect(playerB.getByRole('button', { name: 'Send Invite' })).toBeVisible({
      timeout: 15_000,
    });

    // Player A leaves; B remains leader
    await playerA.getByRole('button', { name: 'Leave Cartel' }).click();
    await expect(playerA.getByRole('button', { name: 'Create Cartel' })).toBeVisible({
      timeout: 20_000,
    });

    await playerB.reload();
    await dismissDevOverlay(playerB);
    await expect(playerB.getByText(/Leader · Active/i)).toBeVisible();
    await expect(playerB.getByText(cartelName)).toBeVisible();

    // Market — A lists, B bids
    await dismissDevOverlay(playerA);
    await gotoGame(playerA, '/market');
    await playerA.getByRole('tab', { name: 'Sell Item' }).click();
    const sellPanel = playerA.locator('main');
    const listBtn = playerA.getByRole('button', { name: /List Item/i });
    if (!(await listBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Player A has no tradable inventory for market E2E');
    }

    const cashBeforeList = parseMoney(await headerCashLocator(playerA).textContent());
    await sellPanel.getByRole('combobox').first().selectOption('hash');
    await playerA.locator('#market-qty').fill('1');
    await playerA.locator('#market-price').fill(String(listingPrice));
    await dismissDevOverlay(playerA);
    await listBtn.click();
    await expect(playerA.getByText(/Listed 1× Hash on the Market/i)).toBeVisible({ timeout: 20_000 });
    await playerA.getByRole('tab', { name: 'Browse' }).click();
    await expect(
      playerA
        .locator('.g-listing-card')
        .filter({ hasText: `Starting: ${listingPriceLabel}` })
        .filter({ hasText: /hash × 1/i })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await playerA.getByRole('tab', { name: 'My Auctions' }).click();
    await expect(
      playerA
        .locator('.g-row')
        .filter({ hasText: 'hash × 1' })
        .filter({ hasText: new RegExp(`${listingPriceLabel.replace('$', '\\$')} · ACTIVE`) })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await gotoGame(playerB, '/command');
    await dismissDevOverlay(playerB);
    await gotoGame(playerB, '/market');
    const listing = playerB
      .locator('.g-listing-card')
      .filter({ hasText: `Starting: ${listingPriceLabel}` })
      .filter({ hasText: /hash × 1/i })
      .last();
    await expect(listing).toBeVisible({ timeout: 15_000 });
    const cashBeforeBid = parseMoney(await headerCashLocator(playerB).textContent());
    await listing.getByRole('button', { name: 'Place bid' }).click();
    await expect
      .poll(async () => parseMoney(await headerCashLocator(playerB).textContent()))
      .toBeLessThan(cashBeforeBid);

    expect(cashBeforeList).toBeGreaterThan(0);

    await assertNoStuckLoading(playerA);
    await assertNoStuckLoading(playerB);
    await assertNoStuckLoading(playerC);

    await playerA.close();
    await playerB.close();
    await playerC.close();
  });
});
