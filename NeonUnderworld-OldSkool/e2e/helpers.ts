import { expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminChangeMe123!';

/** Dismiss intro screen — clicks Enter when the boot overlay is visible. */
export async function dismissBootScreen(page: Page) {
  const boot = page.locator('.nu-boot');
  if (!(await boot.count())) return;

  const enter = page.getByRole('button', { name: /ENTER EMPIRE|SIGN IN/i });
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
  }

  await boot.waitFor({ state: 'detached', timeout: 20_000 });
}

/** @deprecated Use dismissBootScreen */
export async function waitForBootScreen(page: Page) {
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
