import { test, expect } from '@playwright/test';
import {
  login,
  gotoGame,
  headerCashLocator,
  parseMoney,
  dismissBootScreen,
  dismissDevOverlay,
} from './helpers';

test.describe('THE WIRE — typed commands', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function gotoSettings(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'More menu' }).click();
    await page
      .getByRole('dialog', { name: 'More' })
      .getByRole('link', { name: 'Settings', exact: true })
      .click();
    await page.waitForURL(/\/settings/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 15_000 });
  }

  async function ensureWireOff(page: import('@playwright/test').Page) {
    await gotoSettings(page);
    const offButton = page.locator('.g-settings-wire-toggle').getByRole('button', { name: 'OFF', exact: true });
    if ((await offButton.getAttribute('aria-pressed')) !== 'true') {
      await offButton.click();
      await expect(offButton).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
    }
    await gotoGame(page, '/command');
  }

  async function enableWire(page: import('@playwright/test').Page) {
    await gotoSettings(page);
    const onButton = page.locator('.g-settings-wire-toggle').getByRole('button', { name: 'ON', exact: true });
    const pressed = await onButton.getAttribute('aria-pressed');
    if (pressed !== 'true') {
      await onButton.click();
      await expect(onButton).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
    }
  }

  test('wire control hidden until enabled in settings', async ({ page }) => {
    await login(page);
    await dismissBootScreen(page);
    await dismissDevOverlay(page);
    await ensureWireOff(page);
    await gotoGame(page, '/command');
    await expect(page.getByTestId('wire-fab')).toHaveCount(0);

    await enableWire(page);
    await gotoGame(page, '/command');
    await expect(page.getByTestId('wire-fab')).toBeVisible();
  });

  test('stat command displays live result', async ({ page }) => {
    await login(page);
    await dismissBootScreen(page);
    await dismissDevOverlay(page);
    await enableWire(page);
    await gotoGame(page, '/command');

    const cashBefore = parseMoney(await headerCashLocator(page).textContent());
    await page.getByTestId('wire-fab').click();
    await page.getByTestId('wire-input').fill("what's my cash");
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByTestId('wire-result')).toContainText('CASH');
    await expect(page.getByTestId('wire-result')).toContainText(cashBefore.toLocaleString());
  });

  test('buy requires confirmation and updates header cash', async ({ page }) => {
    await login(page);
    await dismissBootScreen(page);
    await dismissDevOverlay(page);
    await enableWire(page);
    await gotoGame(page, '/command');

    const cashBefore = parseMoney(await headerCashLocator(page).textContent());
    await page.getByTestId('wire-fab').click();
    await page.getByTestId('wire-input').fill('buy 1 beer');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByTestId('wire-confirm')).toBeVisible();
    await page.getByTestId('wire-cancel-purchase').click();
    await expect(page.getByTestId('wire-confirm')).toHaveCount(0);

    await page.getByTestId('wire-input').fill('buy 1 beer');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByTestId('wire-confirm-purchase').click();

    await expect(page.getByTestId('wire-result')).toContainText('ORDER COMPLETE');
    const cashAfter = parseMoney(await headerCashLocator(page).textContent());
    expect(cashAfter).toBeLessThan(cashBefore);
  });

  test('navigation command routes via Next router', async ({ page }) => {
    await login(page);
    await dismissBootScreen(page);
    await dismissDevOverlay(page);
    await enableWire(page);
    await gotoGame(page, '/command');

    await page.getByTestId('wire-fab').click();
    await page.getByTestId('wire-input').fill('open shop');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page).toHaveURL(/\/shop/);
    await expect(page.getByTestId('wire-panel')).toHaveCount(0);
  });

  test('hire thugs shows coming soon without shop purchase', async ({ page }) => {
    await login(page);
    await dismissBootScreen(page);
    await dismissDevOverlay(page);
    await enableWire(page);
    await gotoGame(page, '/command');

    await page.getByTestId('wire-fab').click();
    await page.getByTestId('wire-input').fill('hire 100 thugs');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByTestId('wire-result')).toContainText('COMING SOON');
  });
});
