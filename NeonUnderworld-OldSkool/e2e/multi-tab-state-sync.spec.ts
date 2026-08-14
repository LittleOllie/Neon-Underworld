import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  loginAs,
  gotoGame,
  gotoPath,
  dismissBootScreen,
  headerTurnsLocator,
  parseTurnsUsed,
  FRESH_E2E_EMAIL,
  FRESH_E2E_PASSWORD,
} from './helpers';

test.describe('Multi-tab state sync', () => {
  test.beforeAll(() => {
    execSync('npm run db:seed:fresh-e2e', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
      env: process.env,
    });
  });

  test('Tab B reflects Tab A scout mutation after navigation', async ({ browser }) => {
    const tabA = await browser.newPage();
    const tabB = await browser.newPage();

    await loginAs(tabA, FRESH_E2E_EMAIL, FRESH_E2E_PASSWORD);
    await loginAs(tabB, FRESH_E2E_EMAIL, FRESH_E2E_PASSWORD);

    const turnsBefore = parseTurnsUsed(await headerTurnsLocator(tabA).textContent());

    await gotoGame(tabA, '/scout');
    await tabA.getByRole('button', { name: '25', exact: true }).click();
    await tabA.getByRole('button', { name: /^Scout .+\?$/ }).click();
    await expect(tabA.getByRole('heading', { name: 'Scout Complete' })).toBeVisible({ timeout: 30_000 });

    await gotoGame(tabB, '/command');
    await dismissBootScreen(tabB);
    await expect
      .poll(async () => parseTurnsUsed(await headerTurnsLocator(tabB).textContent()))
      .toBeLessThan(turnsBefore);

    await tabA.close();
    await tabB.close();
  });
});
