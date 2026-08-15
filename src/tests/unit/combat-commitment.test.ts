import { describe, expect, it } from 'vitest';
import {
  COMBAT_COMMITMENT_RULES,
  maxCommitmentForAttack,
  suggestedCommitmentForAttack,
} from '@/lib/game-engine/combat/commitment';
import { resolveCasualties } from '@/lib/game-engine/combat/casualties';
import { createCombatRng } from '@/lib/game-engine/combat/combat-random';
import { validateAttackEligibilityCode } from '@/lib/game-engine/combat/eligibility';

const baseEligibility = {
  attackerId: 'a',
  defenderId: 'b',
  attackerDistrictId: 'd1',
  defenderDistrictId: 'd1',
  attackerNw: 1_000_000,
  defenderNw: 800_000,
  attackerTurns: 100,
  attackerRides: 10_000,
  attackerLifeStatus: 'ACTIVE',
  attackerTravelling: false,
  defenderLifeStatus: 'ACTIVE',
  defenderTravelling: false,
  intelReport: {
    targetPlayerId: 'b',
    targetAlias: 'def',
    targetCity: 'Neon',
    scoutedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    confidencePercent: 80,
    canonicalNetWorthAtScout: 800_000,
    estimatedThugs: 500,
    estimatedWeaponStrength: 100,
    estimatedCash: 50_000,
    estimatedDrugs: 1000,
    cartelId: null,
  },
  attacksOnTargetLast24h: 0,
  allowDirectAttack: true,
};

describe('combat commitment scaling', () => {
  it('scales max commit with owned thugs by attack type', () => {
    expect(maxCommitmentForAttack('DRIVE_BY', 1000)).toBe(
      Math.max(COMBAT_COMMITMENT_RULES.DRIVE_BY.minimumCommit, 80),
    );
    expect(maxCommitmentForAttack('HOME_INVASION', 10_000)).toBe(1600);
    expect(maxCommitmentForAttack('RAID_DRUG_LABS', 20_000)).toBe(4000);
  });

  it('never exceeds owned thugs or absolute cap', () => {
    expect(maxCommitmentForAttack('RAID_DRUG_LABS', 500)).toBe(300);
    expect(maxCommitmentForAttack('RAID_DRUG_LABS', 5000)).toBe(1000);
    expect(maxCommitmentForAttack('RAID_DRUG_LABS', 100_000)).toBe(
      COMBAT_COMMITMENT_RULES.RAID_DRUG_LABS.absoluteCap,
    );
  });

  it('rejects attacks above type-specific max commit', () => {
    const code = validateAttackEligibilityCode({
      ...baseEligibility,
      attackType: 'DRIVE_BY',
      attackingThugs: 9000,
      attackerThugs: 20_000,
    });
    expect(code).toBe('INVALID_FORCE');
  });

  it('allows large home invasion within scaled cap', () => {
    const commit = maxCommitmentForAttack('HOME_INVASION', 15_000);
    const code = validateAttackEligibilityCode({
      ...baseEligibility,
      attackType: 'HOME_INVASION',
      attackingThugs: commit,
      attackerThugs: 15_000,
    });
    expect(code).toBeNull();
  });
});

describe('casualty scaling at larger commits', () => {
  it('produces meaningful absolute losses at 5k vs 500 commits', () => {
    const small = resolveCasualties(500, 400, 1.3, createCombatRng(1));
    const large = resolveCasualties(5000, 4000, 1.3, createCombatRng(2));
    expect(large.attackerLosses).toBeGreaterThan(small.attackerLosses * 5);
  });

  it('large army attack at scaled commit loses meaningful fraction of commit', () => {
    const army = 20_000;
    const commit = maxCommitmentForAttack('HOME_INVASION', army);
    expect(commit).toBeGreaterThan(2000);
    const result = resolveCasualties(commit, Math.floor(commit * 0.8), 1.2, createCombatRng(99));
    expect(result.attackerLosses / commit).toBeGreaterThan(0.05);
  });
});
