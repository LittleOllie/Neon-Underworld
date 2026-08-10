import { expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminChangeMe123!';

/** Wait for startup boot overlay to finish (no-op if already gone). */
export async function waitForBootScreen(page: Page) {
  const boot = page.locator('.nu-boot');
  if (await boot.count()) {
    await boot.waitFor({ state: 'detached', timeout: 10_000 });
  }
}

export async function login(page: Page) {
  await page.goto('/login');
  await waitForBootScreen(page);
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(/\/command/, { timeout: 15_000 });
  await waitForBootScreen(page);
}

export function parseMoney(text: string | null) {
  return Number((text ?? '0').replace(/[^0-9]/g, ''));
}
