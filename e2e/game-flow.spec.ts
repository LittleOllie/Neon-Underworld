import { test, expect } from '@playwright/test';

const INVITE = process.env.SEED_INVITE_CODE ?? 'NEON-ALPHA-2026';
const unique = Date.now();

test.describe('Neon Underworld E2E', () => {
  test('register, scout, and persist state', async ({ page }) => {
    const alias = `TestPlayer_${unique}`;
    const email = `test+${unique}@example.com`;
    const password = 'TestPass123!';

    await page.goto('/register');
    await page.getByLabel('Invite code').fill(INVITE);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByLabel('Alias').fill(alias);
    await page.getByText('Neon Strip').click();
    await page.getByRole('button', { name: /Enter the underworld/i }).click();

    await expect(page).toHaveURL(/\/command/, { timeout: 15000 });
    await expect(page.getByText(alias)).toBeVisible();

    await page.goto('/operations/scout');
    await page.getByRole('button', { name: '100' }).click();
    await page.getByRole('button', { name: /Scout with 100 turns/i }).click();

    await expect(page.getByText(/Scout complete/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: /Return to Command/i }).click();
    await expect(page).toHaveURL(/\/command/);

    await page.goto('/empire');
    await expect(page.getByText('Empire overview')).toBeVisible();
  });

  test('mobile viewport command centre', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await expect(page.getByText('Neon Underworld')).toBeVisible();
  });
});
