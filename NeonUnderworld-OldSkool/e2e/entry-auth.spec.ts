import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, dismissBootScreen } from './helpers';

test.describe('NU entry / auth pages', () => {
  test('login shows intro background and auth form', async ({ page }) => {
    await page.goto('/login');
    await dismissBootScreen(page);
    await expect(page.locator('.nu-page-bg__art')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Neon Underworld' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
  });

  test('login shows Continue with Google when OAuth env is configured', async ({ page }) => {
    test.skip(!process.env.AUTH_GOOGLE_ID, 'Requires AUTH_GOOGLE_ID in test environment');
    await page.goto('/login');
    await dismissBootScreen(page);
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
    await expect(page.getByText('or')).toBeVisible();
  });

  test('register page loads with intro background', async ({ page }) => {
    await page.goto('/register');
    await dismissBootScreen(page);
    await expect(page.locator('.nu-page-bg__art')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await dismissBootScreen(page);
    await expect(page.locator('.nu-page-bg__art')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Forgot Password' })).toBeVisible();
  });

  test('authenticated user visiting login redirects to command', async ({ page }) => {
    await page.goto('/login');
    await dismissBootScreen(page);
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page).toHaveURL(/\/command/, { timeout: 20_000 });
    await dismissBootScreen(page);
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  });
});

test.describe('NU entry — mobile 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('login usable without horizontal overflow', async ({ page }) => {
    await page.goto('/login');
    await dismissBootScreen(page);
    await expect(page.locator('.nu-page-bg__art')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });
});
