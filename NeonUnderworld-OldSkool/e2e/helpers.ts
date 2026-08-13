import { expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminChangeMe123!';

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
  await enter.waitFor({ state: 'visible', timeout: 15_000 });
  await enter.click();
  await boot.waitFor({ state: 'detached', timeout: 20_000 });
}

/** @deprecated Use dismissBootScreen */
export async function waitForBootScreen(page: Page) {
  await dismissBootScreen(page);
}

async function clickNavLink(page: Page, label: string) {
  const primary = page.getByRole('navigation').getByRole('link', { name: label, exact: true });
  if (await primary.first().isVisible().catch(() => false)) {
    await primary.first().click();
    return;
  }

  await page.getByRole('button', { name: 'More menu' }).click();
  await page.getByRole('link', { name: label, exact: true }).click();
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
      { timeout: 15_000 },
    );
    if (target.search && !page.url().includes(target.search.slice(1))) {
      await page.goto(`${target.pathname}${target.search}`);
    }
    return;
  }

  await page.goto(`${target.pathname}${target.search}`);
  await dismissBootScreen(page);
}

export async function login(page: Page) {
  await page.goto('/login');
  await dismissBootScreen(page);
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(/\/command/, { timeout: 15_000 });
  await dismissBootScreen(page);
}

export function parseMoney(text: string | null) {
  return Number((text ?? '0').replace(/[^0-9]/g, ''));
}
