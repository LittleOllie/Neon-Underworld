import { expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminChangeMe123!';

/** Canonical fresh E2E account — run npm run db:seed:fresh-e2e before tests. */
export const FRESH_E2E_EMAIL = 'fresh-e2e+tester@neonunderworld.local';
export const FRESH_E2E_PASSWORD = 'fresh-e2e-not-for-production';
export const FRESH_E2E_ALIAS = 'FreshE2E';

/** Dev PvP opponent from scripts/seed-dev-pvp-opponents.ts (NeonViper — enough cash to bid). */
export const PVP_BUYER_EMAIL = 'dev-pvp+neonviper@neonunderworld.local';
export const PVP_BUYER_PASSWORD = 'dev-pvp-neonviper-not-for-login';

/** Third dev PvP account for cartel verification E2E. */
export const PVP_PLAYER_C_EMAIL = 'dev-pvp+rustrunner@neonunderworld.local';
export const PVP_PLAYER_C_PASSWORD = 'dev-pvp-rustrunner-not-for-login';

export function headerCashLocator(page: Page) {
  return page.locator('.g-status-item').filter({ hasText: 'Cash' });
}

export function headerTurnsLocator(page: Page) {
  return page.locator('.g-status-item').filter({ hasText: 'Turns' });
}

export function headerPlayerLine(page: Page) {
  return page.locator('.g-player-line');
}

export function parseMoney(text: string | null) {
  return Number((text ?? '0').replace(/[^0-9]/g, ''));
}

export function parseTurnsUsed(text: string | null): number {
  const match = (text ?? '').match(/([\d,]+)\s*\//);
  return parseMoney(match?.[1] ?? '0');
}

/** Grant playtest turns when the dev account is depleted (E2E stability). */
export async function ensureMinTurns(page: Page, minimum = 100) {
  await ensureGameReady(page);
  const current = parseTurnsUsed(await headerTurnsLocator(page).textContent());
  if (current >= minimum) return;

  await gotoPath(page, '/playtest/turns');

  const grantBtn = page.getByRole('button', { name: '+500 turns' });
  if (!(await grantBtn.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await grantBtn.click();
  await expect(page.getByRole('heading', { name: 'Turns updated' })).toBeVisible({
    timeout: 15_000,
  });
  const after = parseTurnsUsed(await headerTurnsLocator(page).textContent());
  expect(after).toBeGreaterThanOrEqual(minimum);
}

/** Buy button on a shop catalog row (legacy — prefer purchaseViaSupplyOrder). */
export function catalogBuyButton(page: Page, index = 0) {
  return page.locator('.g-shop-controls').getByRole('button', { name: 'Buy now', exact: true }).nth(index);
}

/** Add first affordable catalog line to supply order, review, and checkout. */
export async function purchaseViaSupplyOrder(
  page: Page,
  options?: { tab?: string; itemLabel?: RegExp | string; quantity?: string },
) {
  await ensureGameReady(page);
  if (options?.tab) {
    await page.getByRole('button', { name: options.tab }).click();
  }
  const qtyField = options?.itemLabel
    ? page.getByLabel(options.itemLabel)
    : page.getByLabel(/Quantity of/i).first();
  if (options?.quantity) {
    await qtyField.fill(options.quantity);
  }
  await page.locator('.g-shop-controls').getByRole('button', { name: 'Add to order' }).first().click();
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'BUY EVERYTHING' }).click();
  await expect(page.getByRole('heading', { name: 'Purchase Complete' })).toBeVisible({
    timeout: 15_000,
  });
}

/** Buy enough rides on the Vehicles tab so travel is unblocked. */
export async function ensureTravelRides(page: Page) {
  await gotoGame(page, '/travel');
  const ridesWarn = page.getByText(/You need (\d+) more rides to travel/i);
  if (!(await ridesWarn.isVisible().catch(() => false))) return;

  const needed = parseInt((await ridesWarn.textContent())?.match(/(\d+) more rides/)?.[1] ?? '0', 10);
  if (needed <= 0) return;

  await gotoGame(page, '/shop');
  await page.getByRole('button', { name: 'Vehicles' }).click();
  await purchaseViaSupplyOrder(page, { itemLabel: /Quantity of Ride/i, quantity: String(needed) });
  await page.getByRole('button', { name: 'Shop Again', exact: true }).click();
}

export async function assertNoStuckLoading(page: Page) {
  await ensureGameReady(page);
  await expect(page.locator('.g-travel-overlay')).toHaveCount(0);
  await expect(page.locator('.g-route-loading')).toHaveCount(0);
}

/** Dismiss Next.js dev issue overlay when it intercepts clicks in local E2E. */
export async function dismissDevOverlay(page: Page) {
  const collapse = page.getByRole('button', { name: 'Collapse issues badge' });
  if (await collapse.isVisible().catch(() => false)) {
    await collapse.click().catch(() => {});
  }
}

const PRIMARY_NAV: Record<string, string> = {
  '/command': 'Home',
  '/empire': 'Empire',
  '/scout': 'Scout',
  '/produce': 'Operations',
  '/shop': 'Shop',
};

const MORE_NAV: Record<string, string> = {
  '/attack': 'Attack',
  '/market': 'Market',
  '/travel': 'Travel',
  '/businesses': 'Businesses',
  '/cartels': 'Factions',
  '/rankings': 'Rankings',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

/** Dismiss intro screen — waits for boot ready, clicks Enter, waits for overlay gone. */
export async function dismissBootScreen(page: Page) {
  const boot = page.locator('.nu-boot');
  if ((await boot.count()) === 0) return;
  if (!(await boot.isVisible().catch(() => false))) return;

  const enter = boot.locator('.nu-boot__enter');
  try {
    await enter.waitFor({ state: 'visible', timeout: 45_000 });
    await enter.click({ timeout: 10_000 });
  } catch {
    if (!(await boot.isVisible().catch(() => false))) return;
    await boot.waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => {});
    return;
  }

  await boot.waitFor({ state: 'hidden', timeout: 25_000 }).catch(async () => {
    await boot.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
  });

  await page.evaluate(() => {
    try {
      sessionStorage.setItem('nu-boot-dismissed', '1');
    } catch {
      /* ignore */
    }
  });
}

/** Boot overlay dismissed and dev tooling out of the way — call before gameplay clicks. */
export async function ensureGameReady(page: Page) {
  await dismissBootScreen(page);
  await dismissDevOverlay(page);
  const boot = page.locator('.nu-boot');
  if ((await boot.count()) > 0) {
    await expect(boot).toBeHidden({ timeout: 20_000 });
  }
}

/**
 * Canonical hard navigation: load route, dismiss boot overlay, wait for URL, ensure overlay gone.
 * Use for deep links and post-reload navigation in E2E.
 */
export async function gotoPath(page: Page, path: string, options?: { allowRedirect?: boolean }) {
  const base =
    page.url().startsWith('http') ? page.url() : `http://127.0.0.1:${process.env.PW_TEST_PORT ?? '3310'}`;
  const target = new URL(path, base);
  // Hard reloads remount boot — preserve per-tab dismissal for authenticated gameplay flows.
  await page.evaluate(() => {
    try {
      if (sessionStorage.getItem('nu-boot-dismissed') === '1') return;
      const path = window.location.pathname;
      const gameRoute =
        path.startsWith('/command') ||
        path.startsWith('/empire') ||
        path.startsWith('/scout') ||
        path.startsWith('/produce') ||
        path.startsWith('/shop') ||
        path.startsWith('/attack') ||
        path.startsWith('/market') ||
        path.startsWith('/travel') ||
        path.startsWith('/businesses') ||
        path.startsWith('/cartels') ||
        path.startsWith('/rankings') ||
        path.startsWith('/reports') ||
        path.startsWith('/settings');
      if (gameRoute) {
        sessionStorage.setItem('nu-boot-dismissed', '1');
      }
    } catch {
      /* ignore */
    }
  });
  await page.goto(`${target.pathname}${target.search}`);
  if (!options?.allowRedirect) {
    await page.waitForURL(
      new RegExp(`${target.pathname.replace(/\//g, '\\/')}(\\?|$)`),
      { timeout: 15_000 },
    );
  }
  await ensureGameReady(page);
}

/** @deprecated Use dismissBootScreen */
export async function waitForBootScreen(page: Page) {
  await dismissBootScreen(page);
}

async function clickNavLink(page: Page, label: string) {
  await ensureGameReady(page);
  const nav = page.getByRole('navigation');
  const primary = nav.getByRole('link', { name: label, exact: true });
  if (await primary.first().isVisible().catch(() => false)) {
    await primary.first().click();
    return;
  }

  await page.getByRole('button', { name: 'More menu' }).click();
  await page
    .getByRole('dialog', { name: 'More' })
    .getByRole('link', { name: new RegExp(`^${label}(\\s|$)`) })
    .click();
}

/** Navigate in-app without re-triggering the full-screen boot overlay. */
export async function gotoGame(page: Page, path: string) {
  const target = new URL(path, page.url());
  const current = new URL(page.url());
  if (current.pathname === target.pathname && current.search === target.search) return;

  const label = PRIMARY_NAV[target.pathname] ?? MORE_NAV[target.pathname];
  if (label) {
    await clickNavLink(page, label);
    await page.waitForURL(
      new RegExp(`${target.pathname.replace(/\//g, '\\/')}(\\?|$)`),
      { timeout: 30_000 },
    );
    if (target.search && !page.url().includes(target.search.slice(1))) {
      await gotoPath(page, `${target.pathname}${target.search}`);
    }
    await ensureGameReady(page);
    return;
  }

  await gotoPath(page, `${target.pathname}${target.search}`);
}

export async function loginAs(page: Page, email: string, password: string) {
  await gotoPath(page, '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(/\/command/, { timeout: 15_000 });
  await dismissBootScreen(page);
  await page.evaluate(() => {
    try {
      sessionStorage.setItem('nu-boot-dismissed', '1');
    } catch {
      /* ignore */
    }
  });
  await dismissDevOverlay(page);
  const boot = page.locator('.nu-boot');
  if ((await boot.count()) > 0) {
    await expect(boot).toBeHidden({ timeout: 20_000 });
  }
}

export async function login(page: Page) {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

/** Empire accordion section by exact title (SPECIALISTS, ENFORCERS, etc.). */
export function empireSection(page: Page, title: string) {
  return page.locator('details.g-empire-section').filter({
    has: page.locator('.g-business-section-title', { hasText: new RegExp(`^${title}$`) }),
  });
}
