import { test, expect } from '@playwright/test';
import { login, gotoGame, empireSection } from './helpers';

const MOBILE_WIDTHS = [375, 390, 430] as const;

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  expect(overflow).toBe(false);
}

for (const width of MOBILE_WIDTHS) {
  test.describe(`Empire collapsed UX @ ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });

    test('collapsed sections, accordion interaction, payout in Workers', async ({ page }) => {
      await login(page);
      await gotoGame(page, '/empire');
      await expect(page.getByRole('heading', { name: 'Empire' })).toBeVisible();
      await expect(page.getByLabel('Empire summary')).toBeVisible();
      await assertNoHorizontalOverflow(page);

      const workers = empireSection(page, 'WORKERS');
      await expect(workers).toHaveCount(1);
      await expect(workers).not.toHaveAttribute('open', '');

      await expect(empireSection(page, 'THUGS')).toHaveCount(1);
      await expect(empireSection(page, 'DRUGS')).toHaveCount(1);
      await expect(empireSection(page, 'GEAR')).toHaveCount(1);
      await expect(empireSection(page, 'BUSINESSES')).toHaveCount(1);

      await workers.locator('summary').click();
      await expect(page.getByText('Street happiness').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Increase payout' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save Payout' })).toBeVisible();
      await assertNoHorizontalOverflow(page);

      const drugsBadge = empireSection(page, 'DRUGS').locator('.g-business-section-badge');
      await expect(drugsBadge).toContainText('STREET UNITS');

      await workers.locator('summary').click();

      const thugs = empireSection(page, 'THUGS');
      await thugs.locator('summary').click();
      await expect(page.getByText('Armed (street)').first()).toBeVisible();
      await thugs.locator('summary').click();

      const drugs = empireSection(page, 'DRUGS');
      await drugs.locator('summary').click();
      await expect(page.getByText('Hash').first()).toBeVisible();
      await drugs.locator('summary').click();

      const gear = empireSection(page, 'GEAR');
      await gear.locator('summary').click();
      await expect(page.getByText('Rides').first()).toBeVisible();
      await gear.locator('summary').click();

      const businesses = empireSection(page, 'BUSINESSES');
      await businesses.locator('summary').click();
      await expect(page.getByRole('link', { name: /Manage Businesses/i })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  });
}

test.describe('Rankings district default @ 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('defaults to player district and allows Overall', async ({ page }) => {
    await login(page);
    await gotoGame(page, '/rankings');

    const headerText = await page.locator('.g-top').innerText();
    const districtMatch = headerText.match(/·\s*(Neon Strip|Docklands|Old Quarter)/);
    expect(districtMatch).toBeTruthy();
    const playerDistrict = districtMatch![1];

    const activeFilter = page.locator('.g-filter-active');
    await expect(activeFilter).toHaveText(playerDistrict);

    await page.getByRole('link', { name: 'Overall', exact: true }).click();
    await expect(page.locator('.g-filter-active')).toHaveText('Overall');

    await gotoGame(page, '/rankings');
    await expect(page.locator('.g-filter-active')).toHaveText(playerDistrict);
  });
});
