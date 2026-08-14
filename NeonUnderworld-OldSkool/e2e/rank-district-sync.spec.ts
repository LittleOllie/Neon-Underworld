import { test, expect } from '@playwright/test';
import {
  login,
  gotoGame,
  ensureTravelRides,
  empireSection,
} from './helpers';

function parseDistrictRank(text: string): number {
  const match = text.match(/#\s*([\d,]+)/);
  return Number((match?.[1] ?? '0').replace(/,/g, ''));
}

function parseDistrictName(headerText: string): string | null {
  const match = headerText.match(/·\s*(Neon Strip|Docklands|Old Quarter)/);
  return match?.[1] ?? null;
}

async function headerDistrictRank(page: import('@playwright/test').Page): Promise<number> {
  const rankItem = page.locator('.g-status-item--district-rank');
  await expect(rankItem).toBeVisible();
  return parseDistrictRank((await rankItem.textContent()) ?? '');
}

async function headerDistrictName(page: import('@playwright/test').Page): Promise<string> {
  const topText = await page.locator('.g-top').innerText();
  const district = parseDistrictName(topText);
  expect(district).toBeTruthy();
  return district!;
}

async function rankingsYouRank(page: import('@playwright/test').Page): Promise<number> {
  const youRow = page.locator('.g-rank-you');
  await expect(youRow).toBeVisible();
  return parseDistrictRank((await youRow.locator('.g-rank-num').textContent()) ?? '');
}

async function empireDistrictRank(page: import('@playwright/test').Page): Promise<number> {
  await gotoGame(page, '/empire');
  const summary = page.getByLabel('Empire summary');
  await expect(summary).toBeVisible();
  const rankRow = summary.locator('.g-row').filter({ hasText: 'District Rank' });
  return parseDistrictRank((await rankRow.textContent()) ?? '');
}

test.describe('District rank consistency @ 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('header, empire and district rankings agree', async ({ page }) => {
    await login(page);

    const district = await headerDistrictName(page);
    const headerRank = await headerDistrictRank(page);

    const empireRank = await empireDistrictRank(page);
    expect(empireRank).toBe(headerRank);

    await gotoGame(page, '/rankings');
    await expect(page.locator('.g-filter-active')).toHaveText(district);
    const listRank = await rankingsYouRank(page);
    expect(listRank).toBe(headerRank);

    await page.getByRole('link', { name: 'Overall', exact: true }).click();
    await expect(page.locator('.g-filter-active')).toHaveText('Overall');
    await expect(page.locator('.g-rank-you')).toBeVisible();

    const otherDistrict = district === 'Neon Strip' ? 'Docklands' : 'Neon Strip';
    await page.getByRole('link', { name: otherDistrict, exact: true }).click();
    await expect(page.locator('.g-filter-active')).toHaveText(otherDistrict);

    await gotoGame(page, '/rankings');
    await expect(page.locator('.g-filter-active')).toHaveText(district);
    expect(await rankingsYouRank(page)).toBe(headerRank);
  });
});

test.describe('Travel district rank sync @ 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('travel updates district and rank without stale display', async ({ page }) => {
    await login(page);
    await ensureTravelRides(page);

    const startDistrict = await headerDistrictName(page);
    const startRank = await headerDistrictRank(page);

    await gotoGame(page, '/travel');
    if (await page.getByRole('button', { name: 'Travel Again' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Travel Again' }).click();
    }

    const destCards = page
      .locator('.g-listing-card')
      .filter({ has: page.getByRole('button', { name: 'Travel', exact: true }) });
    await expect(destCards.first()).toBeVisible({ timeout: 10_000 });
    const count = await destCards.count();
    expect(count).toBeGreaterThan(0);

    let targetCard = destCards.first();
    for (let i = 0; i < count; i += 1) {
      const card = destCards.nth(i);
      const title = (await card.locator('.g-area-name').textContent()) ?? '';
      if (!title.includes(startDistrict)) {
        targetCard = card;
        break;
      }
    }

    const targetName = ((await targetCard.locator('.g-area-name').textContent()) ?? '').trim();
    await targetCard.getByRole('button', { name: 'Travel', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Travel Complete' })).toBeVisible({
      timeout: 15_000,
    });

    await expect
      .poll(async () => headerDistrictName(page), { timeout: 10_000 })
      .not.toBe(startDistrict);

    const newDistrict = await headerDistrictName(page);
    expect(newDistrict.length).toBeGreaterThan(0);
    if (targetName) {
      expect(newDistrict).toContain(targetName.split(' ')[0] ?? targetName);
    }

    const newHeaderRank = await headerDistrictRank(page);
    expect(newHeaderRank).toBeGreaterThan(0);

    await gotoGame(page, '/rankings');
    await expect(page.locator('.g-filter-active')).toHaveText(newDistrict);
    const rankingsRank = await rankingsYouRank(page);
    expect(rankingsRank).toBe(newHeaderRank);

    if (startRank !== newHeaderRank || startDistrict !== newDistrict) {
      expect(rankingsRank).not.toBe(startRank === newHeaderRank ? -1 : startRank);
    }

    const empireRank = await empireDistrictRank(page);
    expect(empireRank).toBe(newHeaderRank);
  });
});
