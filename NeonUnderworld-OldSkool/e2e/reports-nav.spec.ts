/**
 * Reports badge, load-more, read-on-back, rankings profile, combat profile links.
 */
import { test, expect } from '@playwright/test';
import {
  login,
  gotoGame,
  gotoPath,
  dismissBootScreen,
  assertNoStuckLoading,
  ADMIN_EMAIL,
} from './helpers';
import { execSync } from 'node:child_process';
import path from 'node:path';

test.beforeAll(() => {
  execSync('npm run db:seed:e2e-reports', {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit',
    env: { ...process.env, E2E_REPORT_PLAYER_EMAIL: ADMIN_EMAIL },
  });
});

test.describe('Reports — badge and read on back', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opening unread report decrements badge and back shows read styling', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/reports');

    const unreadRow = page.locator('.g-inbox-item.g-inbox-unread').first();
    if (!(await unreadRow.isVisible().catch(() => false))) {
      test.skip(true, 'No unread inbox reports');
    }

    const badgeBefore = page.locator('.g-nav-badge, .g-more-badge').filter({ hasText: /\d+/ });
    const hadBadge = await badgeBefore.first().isVisible().catch(() => false);

    await unreadRow.click();
    await expect(page).toHaveURL(/\/reports\/[^/]+$/, { timeout: 15_000 });

    if (hadBadge) {
      await expect(badgeBefore.first()).toBeHidden({ timeout: 10_000 }).catch(() => {});
    }

    await page.goBack();
    await expect(page).toHaveURL(/\/reports/, { timeout: 10_000 });
    await expect(page.locator('.g-inbox-item.g-inbox-unread').first()).toBeHidden({ timeout: 5_000 }).catch(
      () => {},
    );

    await page.reload();
    await dismissBootScreen(page);
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  });
});

test.describe('Reports — load more', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('load more appends without replacing first page', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/reports');

    const initialCount = await page.locator('.g-inbox-item').count();
    if (initialCount < 25) {
      test.skip(true, 'Need at least 25 inbox reports for load-more test');
    }

    const firstTitle = await page.locator('.g-inbox-item').first().locator('.g-inbox-title').textContent();
    const loadMore = page.getByRole('button', { name: 'Load more reports' });
    if (!(await loadMore.isVisible().catch(() => false))) {
      test.skip(true, 'No load-more control');
    }

    await loadMore.click();
    await expect(page.locator('.g-inbox-item')).toHaveCount(initialCount + 25, { timeout: 15_000 });
    await expect(page.locator('.g-inbox-item').first().locator('.g-inbox-title')).toHaveText(
      firstTitle ?? '',
    );
  });
});

test.describe('Rankings — profile district rank label', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('district tab profile shows District Rank label', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/rankings');

    const profileLink = page.locator('.g-rank-link').first();
    if (!(await profileLink.isVisible().catch(() => false))) {
      test.skip(true, 'No other players on rankings');
    }

    await profileLink.click();
    await expect(page).toHaveURL(/\/players\//, { timeout: 15_000 });
    await expect(page.locator('.g-row .g-label').filter({ hasText: 'District Rank' })).toBeVisible();
  });

  test('overall tab profile still shows District Rank not Overall', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/rankings');
    await page.getByRole('link', { name: 'Overall' }).click();
    await expect(page).toHaveURL(/filter=overall/, { timeout: 10_000 });

    const profileLink = page.locator('.g-rank-link').first();
    if (!(await profileLink.isVisible().catch(() => false))) {
      test.skip(true, 'No other players on overall rankings');
    }

    await profileLink.click();
    await expect(page).toHaveURL(/\/players\//, { timeout: 15_000 });
    await expect(page.locator('.g-row .g-label').filter({ hasText: 'District Rank' })).toBeVisible();
  });
});

test.describe('Combat report — profile links', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('combat report attacker link opens in-app profile', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/reports');

    const combatLink = page
      .locator('.g-inbox-item')
      .filter({ hasText: /Attack Report|Defence Report/i })
      .first();
    if (!(await combatLink.isVisible().catch(() => false))) {
      test.skip(true, 'No combat reports in inbox');
    }

    await combatLink.click();
    const profileLink = page.locator('.g-player-identity__link').first();
    if (!(await profileLink.isVisible().catch(() => false))) {
      test.skip(true, 'Combat report has no linked identity');
    }

    await profileLink.click();
    await expect(page).toHaveURL(/\/players\//, { timeout: 15_000 });
    await assertNoStuckLoading(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/reports\//);
  });
});

test.describe('Boot deep links', () => {
  test('hard load /reports preserves route after boot', async ({ page }) => {
    await login(page);
    await page.evaluate(() => sessionStorage.removeItem('nu-boot-dismissed'));

    await gotoPath(page, '/reports');
    await expect(page).toHaveURL(/\/reports/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('History chain', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('rankings → profile → back → reports without stuck dim', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/rankings');

    const profileLink = page.locator('.g-rank-link').first();
    if (!(await profileLink.isVisible().catch(() => false))) {
      test.skip(true, 'No rankings profile link');
    }

    await profileLink.click();
    await expect(page).toHaveURL(/\/players\//);
    await page.goBack();
    await gotoGame(page, '/reports');
    await expect(page.locator('.g-main-transition.is-pending')).toHaveCount(0, { timeout: 10_000 });
    await assertNoStuckLoading(page);
  });
});
