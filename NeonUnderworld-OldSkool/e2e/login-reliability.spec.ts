import { test, expect, type Page } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  dismissBootScreen,
} from './helpers';

async function submitLogin(page: Page, email: string, password: string) {
  await expect(page.locator('form.g-auth-form')).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
}

async function expectLoginError(page: Page, pattern: RegExp) {
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  await expect(page.locator('.g-auth-error')).toHaveText(pattern);
  await expect(page.getByRole('button', { name: /^Sign in$/i })).toBeEnabled();
}

async function expectAuthenticatedCommand(page: Page) {
  await expect(page).toHaveURL(/\/command/, { timeout: 20_000 });
  await dismissBootScreen(page);
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Email')).toHaveCount(0);
}

test.describe('Login reliability — credentials and session confirmation', () => {
  test('invalid credentials show error and stay on login', async ({ page }) => {
    await page.goto('/login');
    await dismissBootScreen(page);
    await submitLogin(page, ADMIN_EMAIL, 'wrong-password-not-valid');
    await expectLoginError(page, /Invalid email or password/i);
  });

  test('valid credentials reach authenticated command', async ({ page }) => {
    await page.goto('/login');
    await dismissBootScreen(page);
    await submitLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expectAuthenticatedCommand(page);
  });

  test('autofill-style immediate submit after fill succeeds', async ({ page }) => {
    await page.goto('/login');
    await dismissBootScreen(page);
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expectAuthenticatedCommand(page);
  });
});

test.describe('Login reliability — sequential cycles', () => {
  test('10 login cycles on desktop Chromium', async ({ page }) => {
    test.setTimeout(240_000);

    for (let i = 0; i < 10; i++) {
      await page.goto('/login');
      await dismissBootScreen(page);
      await submitLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await expectAuthenticatedCommand(page);

      await page.getByRole('button', { name: 'More menu' }).click();
      await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: /^Settings/ }).click();
      await page.getByRole('button', { name: /^Logout$/i }).click();
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    }
  });
});

test.describe('Login reliability — mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile login reaches command', async ({ page }) => {
    await page.goto('/login');
    await dismissBootScreen(page);
    await submitLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expectAuthenticatedCommand(page);
  });

  test('3 sequential mobile login cycles', async ({ page }) => {
    test.setTimeout(120_000);

    for (let i = 0; i < 3; i++) {
      await page.goto('/login');
      await dismissBootScreen(page);
      await submitLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await expectAuthenticatedCommand(page);

      await page.getByRole('button', { name: 'More menu' }).click();
      await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: /^Settings/ }).click();
      await page.getByRole('button', { name: /^Logout$/i }).click();
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    }
  });
});
