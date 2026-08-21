import { describe, it, expect } from 'vitest';
import { ATTACK_RULES, ATTACK_TYPE_LABELS, ATTACK_TYPE_PURPOSE } from '@/config/game/attack-rules';
import {
  attackTypeDescription,
  formatAttackTurnCostDisplay,
  formatAttackTypeOptionLabel,
  formatInsufficientTurnsForAttack,
  formatTurnCount,
} from '@/lib/game-engine/combat/attack-presentation';
import { validateAttackEligibility } from '@/lib/game-engine/combat/eligibility';

describe('attack turn costs', () => {
  it('uses canonical costs 5 / 8 / 10 / 12', () => {
    expect(ATTACK_RULES.turnCosts.DRIVE_BY).toBe(5);
    expect(ATTACK_RULES.turnCosts.HOME_INVASION).toBe(8);
    expect(ATTACK_RULES.turnCosts.RAID_DRUG_LABS).toBe(10);
    expect(ATTACK_RULES.turnCosts.POACH_WORKERS).toBe(12);
  });
});

describe('formatTurnCount', () => {
  it('uses singular Turn for 1', () => {
    expect(formatTurnCount(1)).toBe('1 Turn');
  });

  it('uses plural Turns otherwise', () => {
    expect(formatTurnCount(5)).toBe('5 Turns');
    expect(formatTurnCount(12)).toBe('12 Turns');
  });
});

describe('attack type selector wording', () => {
  it('formats option labels from canonical config', () => {
    expect(formatAttackTypeOptionLabel('DRIVE_BY')).toBe('Strike · 5 Turns');
    expect(formatAttackTypeOptionLabel('HOME_INVASION')).toBe('Breach · 8 Turns');
    expect(formatAttackTypeOptionLabel('RAID_DRUG_LABS')).toBe('Raid · 10 Turns');
    expect(formatAttackTypeOptionLabel('POACH_WORKERS')).toBe('Extraction · 12 Turns');
  });

  it('formats turn cost display from canonical config', () => {
    expect(formatAttackTurnCostDisplay('RAID_DRUG_LABS')).toBe('10 Turns');
  });
});

describe('insufficient turn messaging', () => {
  it('names attack type, required cost, and current balance', () => {
    expect(formatInsufficientTurnsForAttack('POACH_WORKERS', 7)).toBe(
      'Extraction requires 12 Turns. You currently have 7.',
    );
    expect(formatInsufficientTurnsForAttack('DRIVE_BY', 4)).toBe(
      'Strike requires 5 Turns. You currently have 4.',
    );
  });

  it('validateAttackEligibility returns the same wording', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    expect(
      validateAttackEligibility({
        attackerId: 'a',
        defenderId: 'd',
        attackerDistrictId: 'dist',
        defenderDistrictId: 'dist',
        attackType: 'POACH_WORKERS',
        attackingThugs: 50,
        attackerNw: 1_000_000,
        defenderNw: 1_000_000,
        attackerTurns: 7,
        attackerThugs: 200,
        attackerRides: 20,
        attackerLifeStatus: 'ACTIVE',
        attackerTravelling: false,
        defenderLifeStatus: 'ACTIVE',
        defenderTravelling: false,
        intelReport: {
          targetPlayerId: 'd',
          targetAlias: 'Ghost',
          targetCity: 'Neon Strip',
          scoutedAt: now.toISOString(),
          expiresAt: expires.toISOString(),
          confidencePercent: 85,
          canonicalNetWorthAtScout: 1_000_000,
          estimatedThugs: 100,
          estimatedWeaponStrength: 500,
          estimatedCash: 50_000,
          estimatedDrugs: 200,
          cartelId: null,
        },
        attacksOnTargetLast24h: 0,
        defenderWorkers: 50,
      }),
    ).toBe('Extraction requires 12 Turns. You currently have 7.');
  });
});

describe('attack type descriptions', () => {
  it('returns player-facing copy for each type', () => {
    for (const type of Object.keys(ATTACK_TYPE_LABELS) as Array<keyof typeof ATTACK_TYPE_LABELS>) {
      expect(attackTypeDescription(type)).toBe(ATTACK_TYPE_PURPOSE[type]);
      expect(attackTypeDescription(type).length).toBeGreaterThan(20);
    }
  });

  it('differentiates strike from breach', () => {
    expect(attackTypeDescription('DRIVE_BY')).toMatch(/does not take Cash/i);
    expect(attackTypeDescription('HOME_INVASION')).toMatch(/exposed Cash/i);
    expect(attackTypeDescription('RAID_DRUG_LABS')).toMatch(/Components/i);
    expect(attackTypeDescription('POACH_WORKERS')).toMatch(/Specialists/i);
  });
});
