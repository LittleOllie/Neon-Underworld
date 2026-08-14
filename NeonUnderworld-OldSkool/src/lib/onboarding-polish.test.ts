import { describe, it, expect } from 'vitest';
import { REDLITE_TURNS } from '@core/config/game/redlite-rules';
import { TURNS_CONFIG } from '@core/config/game/balance';
import { getScoutAreaDisplays } from '@core/lib/game-engine/scout-display';
import { estimateProducePreview } from '@core/lib/game-engine/produce-economy';
import { SCOUT_RESULT_SECONDARY_ACTIONS } from '@local/lib/scout-result-actions';
import { TURN_QUICK_AMOUNTS } from '@local/components/game/TurnQuickAmounts';
import { getCityShopItem } from '@core/config/game/shop-rules';

describe('canonical turn copy', () => {
  it('uses 500 start, 5000 cap, and 2/5min regen everywhere', () => {
    expect(REDLITE_TURNS.startingTurns).toBe(500);
    expect(REDLITE_TURNS.turnCap).toBe(5000);
    expect(REDLITE_TURNS.turnsPerInterval).toBe(2);
    expect(REDLITE_TURNS.intervalMinutes).toBe(5);
    expect(TURNS_CONFIG.startingTurns).toBe(500);
    expect(TURNS_CONFIG.turnCap).toBe(5000);
  });
});

describe('turn quick amounts', () => {
  it('offers 25, 50, 100, and 250 with 25 as default scout/produce amount', () => {
    expect(TURN_QUICK_AMOUNTS).toEqual([25, 50, 100, 250]);
    expect(TURN_QUICK_AMOUNTS[0]).toBe(25);
  });
});

describe('scout result secondary actions', () => {
  it('links to Shop, Produce, and Home', () => {
    expect(SCOUT_RESULT_SECONDARY_ACTIONS.map((a) => a.label)).toEqual(['Shop', 'Produce', 'Home']);
    expect(SCOUT_RESULT_SECONDARY_ACTIONS.map((a) => a.href)).toEqual([
      '/shop?tab=supplies',
      '/produce',
      '/command',
    ]);
  });
});

describe('scout area descriptions', () => {
  it('surfaces canonical taglines from scout configuration', () => {
    const areas = getScoutAreaDisplays('neon-strip');
    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) {
      expect(area.tagline.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('produce preview updates with amount', () => {
  it('scales estimated output when quick amount changes', () => {
    const base = {
      thugCount: 10,
      prostituteCount: 5,
      drugType: 'hash' as const,
      thugHappiness: 80,
      workerHappiness: 80,
      drugProductionBonus: 0,
    };
    const small = estimateProducePreview({ ...base, turnsSpent: 25 });
    const large = estimateProducePreview({ ...base, turnsSpent: 250 });
    expect(small).not.toBeNull();
    expect(large).not.toBeNull();
    expect(large!.drugMax).toBeGreaterThan(small!.drugMax);
  });
});

describe('shop item purposes', () => {
  it('includes canonical purpose text for core supplies', () => {
    expect(getCityShopItem('beer')?.purpose).toMatch(/thug/i);
    expect(getCityShopItem('condom')?.purpose).toMatch(/worker/i);
    expect(getCityShopItem('hash')?.purpose).toMatch(/worker/i);
    expect(getCityShopItem('ride')?.purpose).toMatch(/transport|travel/i);
    expect(getCityShopItem('glock')?.purpose).toMatch(/weapon|combat/i);
  });
});
