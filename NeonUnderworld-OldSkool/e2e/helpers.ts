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
  await dismissBootScreen(page);
  const current = parseTurnsUsed(await headerTurnsLocator(page).textContent());
  if (current >= minimum) return;

  await page.goto('/playtest/turns');
  const boot = page.locator('.nu-boot');
  if (await boot.isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.locator('.nu-boot__enter').click({ force: true });
    await boot.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
  }

  const grantBtn = page.getByRole('button', { name: '+500 turns' });
  if (!(await grantBtn.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await grantBtn.click();
  await expect(page.getByRole('heading', { name: 'Turns updated' })).toBeVisible({
    timeout: 15_000,
  });
  const after = parseTurnsUsed(await headerTurnsLocator(page).textContent());
  expect(after).toBeGreaterThanOrEqual(minimum);
}

/** Buy button on a shop catalog row (not the Buy/Sell mode toggle). */
export function catalogBuyButton(page: Page, index = 0) {
  return page.locator('.g-shop-controls').getByRole('button', { name: 'Buy', exact: true }).nth(index);
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
  await page.getByLabel(/Quantity of Ride/i).fill(String(needed));
  await catalogBuyButton(page).click();
  await expect(page.getByRole('heading', { name: 'Purchase Complete' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Shop Again', exact: true }).click();
}

export async function assertNoStuckLoading(page: Page) {
  await expect(page.locator('.nu-boot')).toHaveCount(0);
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
  '/produce': 'Produce',
  '/shop': 'Shop',
};

const MORE_NAV: Record<string, string> = {
  '/attack': 'Attack',
  '/market': 'Market',
  '/travel': 'Travel',
  '/businesses': 'Businesses',
  '/cartels': 'Cartels',
  '/rankings': 'Rankings',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

/** Dismiss intro screen — clicks the boot overlay primary action when visible. */
export async function dismissBootScreen(page: Page) {
  const boot = page.locator('.nu-boot');
  if (!(await boot.count())) return;

  try {
    await boot.waitFor({ state: 'visible', timeout: 5_000 });
  } catch {
    return;
  }

  const enter = boot.locator('.nu-boot__enter');
  try {
    await Promise.race([
      enter.waitFor({ state: 'visible', timeout: 45_000 }),
      boot.waitFor({ state: 'hidden', timeout: 45_000 }),
    ]);
  } catch {
    return;
  }

  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
  }
  await boot.waitFor({ state: 'hidden', timeout: 20_000 }).catch(async () => {
    await boot.waitFor({ state: 'detached', timeout: 20_000 });
  });
}

/**
 * Canonical hard navigation: load route, dismiss boot overlay, wait for URL, ensure overlay gone.
 * Use for deep links and post-reload navigation in E2E.
 */
export async function gotoPath(page: Page, path: string) {
  const base =
    page.url().startsWith('http') ? page.url() : `http://127.0.0.1:${process.env.PW_TEST_PORT ?? '3310'}`;
  const target = new URL(path, base);
  await page.goto(`${target.pathname}${target.search}`);
  await dismissBootScreen(page);
  await page.waitForURL(
    new RegExp(`${target.pathname.replace(/\//g, '\\/')}(\\?|$)`),
    { timeout: 15_000 },
  );
  await expect(page.locator('.nu-boot')).toBeHidden({ timeout: 20_000 }).catch(() => {});
}

/** @deprecated Use dismissBootScreen */
export async function waitForBootScreen(page: Page) {
  await dismissBootScreen(page);
}

async function clickNavLink(page: Page, label: string) {
  await dismissBootScreen(page);
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
    return;
  }

  await gotoPath(page, `${target.pathname}${target.search}`);
}

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await dismissBootScreen(page);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(/\/command/, { timeout: 15_000 });
  await dismissBootScreen(page);
}

export async function login(page: Page) {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

/** Empire accordion section by exact title (WORKERS, THUGS, etc.). */
export function empireSection(page: Page, title: string) {
  return page.locator('details.g-empire-section').filter({
    has: page.locator('.g-business-section-title', { hasText: new RegExp(`^${title}$`) }),
  });
}
