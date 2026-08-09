import { test, expect } from '@playwright/test';
import path from 'node:path';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminChangeMe123!';

const OUT = path.join(__dirname, '../screenshots/ui-review');

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Enter District Network/i }).click();
  await expect(page).toHaveURL(/\/command/, { timeout: 15000 });
}

test.describe('UI review screenshots', () => {
  test('capture desktop and mobile pages', async ({ browser }) => {
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const d = await desktop.newPage();
    const m = await mobile.newPage();

    await login(d);
    await login(m);

    const shots: { page: typeof d; path: string; url: string }[] = [
      { page: d, path: 'command-desktop.png', url: '/command' },
      { page: m, path: 'command-mobile.png', url: '/command' },
      { page: d, path: 'empire-desktop.png', url: '/empire' },
      { page: m, path: 'empire-mobile.png', url: '/empire' },
      { page: m, path: 'scout-mobile.png', url: '/scout' },
      { page: m, path: 'produce-mobile.png', url: '/produce' },
      { page: m, path: 'shop-mobile.png', url: '/shop' },
      { page: m, path: 'attack-mobile.png', url: '/attack' },
      { page: m, path: 'reports-mobile.png', url: '/reports' },
      { page: m, path: 'rankings-mobile.png', url: '/rankings' },
    ];

    for (const shot of shots) {
      await shot.page.goto(shot.url);
      await shot.page.waitForLoadState('networkidle');
      await shot.page.screenshot({ path: path.join(OUT, shot.path), fullPage: true });
    }

    await desktop.close();
    await mobile.close();
  });
});
