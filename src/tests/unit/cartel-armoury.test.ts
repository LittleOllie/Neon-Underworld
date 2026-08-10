import { describe, it, expect } from 'vitest';
import {
  CARTEL_ARMOURY_ITEMS,
  cartelArmouryPurchaseTotal,
  getCartelArmouryItem,
  isCartelArmouryItem,
} from '@/config/game/cartel-armoury-rules';
import { cartelAssetsFromRecord, calculateCartelNetWorth } from '@/lib/game-engine/cartel-economics';
import { resolveCombat, deriveCombatSeed } from '@/lib/game-engine/combat/resolve-combat';

describe('cartel armoury rules', () => {
  it('offers thug, glock, and uzi only', () => {
    expect(CARTEL_ARMOURY_ITEMS.map((i) => i.key)).toEqual(['thug', 'glock', 'uzi']);
    expect(isCartelArmouryItem('ak')).toBe(false);
    expect(isCartelArmouryItem('uzi')).toBe(true);
  });

  it('uses city shop weapon prices and thug NW value', () => {
    expect(getCartelArmouryItem('glock')?.unitPrice).toBe(500);
    expect(getCartelArmouryItem('uzi')?.unitPrice).toBe(1500);
    expect(getCartelArmouryItem('thug')?.unitPrice).toBe(700);
    expect(cartelArmouryPurchaseTotal('thug', 10)).toBe(7000);
  });

  it('reads armoury assets from cartel record', () => {
    expect(
      cartelAssetsFromRecord({ treasuryCash: 5000, thugs: 12, glocks: 3, uzis: 2 }),
    ).toEqual({ treasuryCash: 5000, thugs: 12, glocks: 3, uzis: 2 });
    expect(calculateCartelNetWorth({ treasuryCash: 1000, thugs: 5 })).toBe(1000 + 5 * 700);
  });
});

describe('cartel armoury combat', () => {
  it('adds owned cartel thug strength and applies cartel casualties separately', () => {
    const seed = deriveCombatSeed('a', 'd', 'armoury-key');
    const result = resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 100,
      seed,
      cartelArmoury: { thugs: 50, glocks: 0, uzis: 50 },
      attacker: {
        thugs: 200,
        glocks: 0,
        uzis: 0,
        aks: 200,
        cash: 0,
        drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      },
      defender: {
        thugs: 20,
        glocks: 10,
        uzis: 0,
        aks: 0,
        cash: 0,
        drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      },
    });

    expect(result.defenderLosses).toBeLessThanOrEqual(20);
    expect(result.cartelThugLosses).toBeGreaterThanOrEqual(0);
    expect(result.defenderLosses + result.cartelThugLosses).toBeLessThanOrEqual(70);
    expect(result.defenderForceSnapshot.cartelArmouryThugs).toBe(50);
  });
});
