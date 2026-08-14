import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  loginAs,
  gotoGame,
  parseMoney,
  dismissDevOverlay,
  PVP_BUYER_EMAIL,
  PVP_BUYER_PASSWORD,
  PVP_PLAYER_C_EMAIL,
  PVP_PLAYER_C_PASSWORD,
} from './helpers';

test.describe('Cartel Defence v2 — multi-player', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240_000);

  let cartelName = '';
  let memberAlias = '';
  let intelReportId = '';

  test.beforeAll(() => {
    execSync('npm run db:seed:dev-pvp', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
      env: process.env,
    });
    const out = execSync('npx tsx scripts/e2e-cartel-defence-setup.ts', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
      env: process.env,
    });
    const meta = JSON.parse(out.trim().split('\n').pop() ?? '{}') as {
      cartelName?: string;
      memberAlias?: string;
      intelReportId?: string;
    };
    cartelName = meta.cartelName ?? '';
    memberAlias = meta.memberAlias ?? '';
    intelReportId = meta.intelReportId ?? '';
  });

  test('leader sees rides, transport capacity, and response force on HQ', async ({ browser }) => {
    const leader = await browser.newPage();
    await loginAs(leader, PVP_BUYER_EMAIL, PVP_BUYER_PASSWORD);
    await gotoGame(leader, '/cartels');

    await expect(leader.getByText(cartelName)).toBeVisible({ timeout: 20_000 });
    const forces = leader.locator('section[aria-label="Cartel forces"]');
    await expect(forces.getByText('Rides', { exact: true })).toBeVisible();
    await expect(forces.getByText(/Transport capacity/i)).toBeVisible();
    await expect(forces.getByText(/5 rides · 25 thugs/i)).toBeVisible();

    const response = leader.locator('section[aria-label="Cartel protection"]');
    await expect(response.getByText(/Your max cartel response/i)).toBeVisible();
    await expect(response.getByText(/25 thugs/i)).toBeVisible();
  });

  test('leader can purchase cartel rides from armoury', async ({ browser }) => {
    const leader = await browser.newPage();
    await loginAs(leader, PVP_BUYER_EMAIL, PVP_BUYER_PASSWORD);
    await gotoGame(leader, '/cartels');

    const armoury = leader.locator('section[aria-label="Cartel armoury purchases"]');
    const rideRow = armoury.locator('.g-cartel-armoury__row').filter({ hasText: 'Ride' }).first();
    await rideRow.getByRole('spinbutton').fill('1');
    await dismissDevOverlay(leader);
    await rideRow.getByRole('button', { name: /Buy \$5,000/i }).click();
    await expect(leader.getByText(/purchased 1 Rides/i)).toBeVisible({ timeout: 20_000 });

    const forces = leader.locator('section[aria-label="Cartel forces"]');
    await expect(forces.getByText(/6 rides · 30 thugs/i)).toBeVisible({ timeout: 15_000 });
  });

  test('attacker drive-by deploys capped cartel response and updates shared pool', async () => {
    const out = execSync('npx tsx scripts/e2e-cartel-defence-attack-check.ts', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
      env: process.env,
    });
    const result = JSON.parse(out.trim().split('\n').pop() ?? '{}') as {
      cartelResponseDeployed?: number;
      cartelThugsBefore?: number;
      cartelThugsAfter?: number;
      cartelThugLosses?: number;
    };
    expect(result.cartelResponseDeployed).toBeGreaterThan(0);
    expect(result.cartelThugsAfter).toBeLessThanOrEqual(result.cartelThugsBefore ?? 0);
  });

  test('member sees personal response force cap on HQ', async ({ browser }) => {
    const member = await browser.newPage();
    await loginAs(member, PVP_PLAYER_C_EMAIL, PVP_PLAYER_C_PASSWORD);
    await gotoGame(member, '/cartels');
    await expect(member.getByText(cartelName)).toBeVisible({ timeout: 15_000 });

    const response = member.locator('section[aria-label="Cartel protection"]');
    await expect(response.getByText(/Your max cartel response/i)).toBeVisible();
    const maxResponseText =
      (await response.locator('.g-row').filter({ hasText: 'Your max cartel response' }).textContent()) ??
      '';
    expect(parseMoney(maxResponseText)).toBeGreaterThan(0);
  });
});
