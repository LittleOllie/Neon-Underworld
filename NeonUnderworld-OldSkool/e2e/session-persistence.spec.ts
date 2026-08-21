import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, dismissBootScreen, loginAs } from './helpers';

async function copyAuthCookies(from: BrowserContext, to: BrowserContext) {
  const cookies = await from.cookies();
  const authCookies = cookies.filter(
    (cookie) =>
      cookie.name.includes('authjs.session-token') ||
      cookie.name.includes('authjs.callback-url') ||
      cookie.name.includes('authjs.csrf-token'),
  );
  if (authCookies.length === 0) {
    throw new Error('Expected Auth.js cookies after login');
  }
  await to.addCookies(authCookies);
}

async function expectAuthenticatedCommand(page: Page) {
  await expect(page).toHaveURL(/\/command/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Email')).toHaveCount(0);
}

test.describe('Session persistence — cookie survives BootScreen', () => {
  test('fresh context with saved cookies reaches /command without login form', async ({ browser }) => {
    const loginContext = await browser.newContext();
    const loginPage = await loginContext.newPage();

    await loginAs(loginPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expectAuthenticatedCommand(loginPage);

    const persistedContext = await browser.newContext();
    await copyAuthCookies(loginContext, persistedContext);
    const persistedPage = await persistedContext.newPage();

    await persistedPage.goto('/command');
    await expect(persistedPage.locator('.nu-boot')).toBeVisible({ timeout: 10_000 });
    await dismissBootScreen(persistedPage);
    await expectAuthenticatedCommand(persistedPage);

    await loginContext.close();
    await persistedContext.close();
  });

  test('deep link /empire preserved with saved cookies — no /login redirect', async ({ browser }) => {
    const loginContext = await browser.newContext();
    const loginPage = await loginContext.newPage();

    await loginAs(loginPage, ADMIN_EMAIL, ADMIN_PASSWORD);

    const persistedContext = await browser.newContext();
    await copyAuthCookies(loginContext, persistedContext);
    const persistedPage = await persistedContext.newPage();

    await persistedPage.goto('/empire');
    await expect(persistedPage).toHaveURL(/\/empire/, { timeout: 20_000 });
    await expect(persistedPage.locator('.nu-boot')).toBeVisible({ timeout: 10_000 });
    await dismissBootScreen(persistedPage);
    await expect(persistedPage.getByRole('heading', { name: 'Empire' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(persistedPage).not.toHaveURL(/\/login/);
    await expect(persistedPage.getByLabel('Email')).toHaveCount(0);

    await loginContext.close();
    await persistedContext.close();
  });

  test('deep link /attack preserved with saved cookies — no /login redirect', async ({ browser }) => {
    const loginContext = await browser.newContext();
    const loginPage = await loginContext.newPage();

    await loginAs(loginPage, ADMIN_EMAIL, ADMIN_PASSWORD);

    const persistedContext = await browser.newContext();
    await copyAuthCookies(loginContext, persistedContext);
    const persistedPage = await persistedContext.newPage();

    await persistedPage.goto('/attack');
    await expect(persistedPage).toHaveURL(/\/attack/, { timeout: 20_000 });
    await expect(persistedPage.locator('.nu-boot')).toBeVisible({ timeout: 10_000 });
    await dismissBootScreen(persistedPage);
    await expect(persistedPage.getByRole('heading', { name: 'Attack' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(persistedPage).not.toHaveURL(/\/login/);

    await loginContext.close();
    await persistedContext.close();
  });

  test('explicit logout still rejects protected routes', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await dismissBootScreen(page);

    await page.getByRole('button', { name: 'More menu' }).click();
    await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: /^Settings/ }).click();
    await page.getByRole('button', { name: /^Logout$/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    await page.goto('/command');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe('BootScreen loading race — delayed session', () => {
  test('delayed /api/auth/session keeps Enter hidden on game routes until ready', async ({ page }) => {
    let releaseSession: (() => void) | null = null;
    const sessionGate = new Promise<void>((resolve) => {
      releaseSession = resolve;
    });

    await page.route('**/api/auth/session', async (route) => {
      await sessionGate;
      await route.continue();
    });

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.evaluate(() => sessionStorage.removeItem('nu-boot-dismissed'));
    await page.goto('/command');

    await expect(page.locator('.nu-boot')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('CONNECTING TO THE NETWORK…')).toBeVisible();
    await expect(page.locator('.nu-boot__enter')).toHaveCount(0);

    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/command/);
    await expect(page.locator('.nu-boot__enter')).toHaveCount(0);

    releaseSession?.();
    await expect(page.locator('.nu-boot__enter')).toBeVisible({ timeout: 20_000 });
  });
});
