import { describe, it, expect } from 'vitest';
import { REDLITE_CARTEL } from '@/config/game/redlite-rules';
import {
  calculateCartelNetWorth,
  applyCartelContribution,
  cartelDefenceThugBonus,
  normalizeDonationPercent,
} from '@/lib/game-engine/cartel-economics';
import { resolveCombat, deriveCombatSeed } from '@/lib/game-engine/combat/resolve-combat';
import { ATTACK_RULES } from '@/config/game/attack-rules';

describe('cartel economics', () => {
  it('caps donation at 60%', () => {
    expect(normalizeDonationPercent(60)).toBe(60);
    expect(normalizeDonationPercent(80)).toBe(60);
    expect(normalizeDonationPercent(-5)).toBe(0);
  });

  it('splits street income correctly', () => {
    expect(applyCartelContribution(10_000, 20)).toEqual({
      playerCash: 8000,
      cartelCash: 2000,
    });
    expect(applyCartelContribution(10_000, 0)).toEqual({
      playerCash: 10_000,
      cartelCash: 0,
    });
  });

  it('uses canonical max members', () => {
    expect(REDLITE_CARTEL.maxMembers).toBe(5);
    expect(REDLITE_CARTEL.maxDonationPercent).toBe(60);
  });

  it('cartel net worth is treasury plus shared thugs — not member totals', () => {
    expect(calculateCartelNetWorth({ treasuryCash: 100_000, thugs: 5 })).toBe(103_500);
    expect(calculateCartelNetWorth({ treasuryCash: 25_000 })).toBe(25_000);
  });
});

describe('cartel defence support', () => {
  it('grants 25% of supporter thugs as virtual bonus', () => {
    expect(cartelDefenceThugBonus([{ thugs: 100 }, { thugs: 40 }])).toBe(35);
    expect(cartelDefenceThugBonus([])).toBe(0);
  });

  it('adds cartel support to combat force without defender casualties beyond own thugs', () => {
    const seed = deriveCombatSeed('a', 'd', 'key');
    const withSupport = resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 50,
      seed,
      cartelSupportThugs: 50,
      attacker: {
        thugs: 100,
        glocks: 50,
        uzis: 0,
        aks: 0,
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

    expect(withSupport.defenderLosses).toBeLessThanOrEqual(20);
    expect(withSupport.defenderForceSnapshot.cartelSupportThugs).toBe(50);
    expect(withSupport.defenderForceSnapshot.thugsDefending).toBe(20);
    expect(ATTACK_RULES.cartelDefenceActive).toBe(true);
  });
});
