/**
 * READ-ONLY navigation timing audit — Playwright, does not modify app code.
 * Usage: npx playwright test e2e/perf-nav-audit.spec.ts
 */
import { test, expect } from '@playwright/test';
import { login, gotoGame, dismissBootScreen } from './helpers';

type NavSample = { route: string; label: string; coldMs: number; warmMs: number };

async function measureNav(page: import('@playwright/test').Page, path: string, label: string) {
  const coldStart = Date.now();
  await gotoGame(page, path);
  await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
  const coldMs = Date.now() - coldStart;

  const warmStart = Date.now();
  await gotoGame(page, path);
  await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
  const warmMs = Date.now() - warmStart;

  return { route: path, label, coldMs, warmMs };
}

test.describe('Navigation timing audit — desktop', () => {
  test('measure representative routes', async ({ page }) => {
    test.setTimeout(300_000);
    await login(page);
    await dismissBootScreen(page);

    const routes: { path: string; label: string }[] = [
      { path: '/command', label: 'Command' },
      { path: '/empire', label: 'Empire' },
      { path: '/scout', label: 'Scout' },
      { path: '/produce', label: 'Produce' },
      { path: '/shop', label: 'Shop' },
      { path: '/market', label: 'Market' },
      { path: '/cartels', label: 'Cartels' },
      { path: '/rankings', label: 'Rankings' },
      { path: '/attack', label: 'Attack' },
      { path: '/reports', label: 'Reports' },
      { path: '/travel', label: 'Travel' },
      { path: '/businesses', label: 'Businesses' },
    ];

    const samples: NavSample[] = [];
    for (const r of routes) {
      samples.push(await measureNav(page, r.path, r.label));
    }

    console.log('\n=== NAV TIMING DESKTOP (ms) ===');
    console.table(samples);
    expect(samples.length).toBe(routes.length);
  });
});

test.describe('Navigation timing audit — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('measure core routes', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    await dismissBootScreen(page);

    const routes = ['/command', '/empire', '/scout', '/attack', '/market'];
    const samples: NavSample[] = [];
    for (const path of routes) {
      samples.push(await measureNav(page, path, path));
    }

    console.log('\n=== NAV TIMING MOBILE (ms) ===');
    console.table(samples);
  });
});
