import { describe, it, expect } from 'vitest';
import { deriveCombatSeed, resolveCombat } from '@/lib/game-engine/combat/resolve-combat';
import { resolveTheft } from '@/lib/game-engine/combat/theft';
import { createCombatRng } from '@/lib/game-engine/combat/combat-random';
import { allocateWeaponsForThugs } from '@/lib/game-engine/combat/weapon-allocation';
import { computeCartelResponseForce } from '@/lib/game-engine/cartel-response-force';
import { cartelDefenceThugBonus } from '@/lib/game-engine/cartel-economics';

const emptyDrugs = { hash: 0, shrooms: 0, coke: 0, heroin: 0 };
const largeDrugs = { hash: 5000, shrooms: 4000, coke: 3000, heroin: 2000 };

function standardWeapons(thugs: number) {
  const armed = Math.floor(thugs * 0.65);
  const aks = Math.floor(armed * 0.15);
  const uzis = Math.floor(armed * 0.35);
  const glocks = Math.max(0, armed - aks - uzis);
  return { glocks, uzis, aks };
}

function mixedParticipant(thugs: number, extras?: { cash?: number; drugs?: typeof emptyDrugs }) {
  const w = standardWeapons(thugs);
  return {
    thugs,
    ...w,
    cash: extras?.cash ?? 100_000,
    drugs: extras?.drugs ?? emptyDrugs,
  };
}

function driveByRate(attackingThugs: number, runs: number) {
  const defender = mixedParticipant(100);
  let success = 0;
  let repulsed = 0;
  for (let i = 0; i < runs; i++) {
    const result = resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs,
      seed: deriveCombatSeed('att', 'def', `mono-${attackingThugs}-${i}`),
      attacker: mixedParticipant(attackingThugs),
      defender,
    });
    if (result.outcome === 'SUCCESS') success++;
    if (result.outcome === 'REPULSED') repulsed++;
  }
  return { successRate: success / runs, repulseRate: repulsed / runs };
}

describe('Drive-By outcome rule', () => {
  it('SUCCESS when attackerVictory and defender-side casualties > 0', () => {
    const result = resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 250,
      seed: deriveCombatSeed('a', 'd', 'drive-success'),
      attacker: mixedParticipant(250),
      defender: mixedParticipant(100),
    });
    expect(result.outcome).toBe('SUCCESS');
    expect(result.defenderLosses + result.cartelThugLosses).toBeGreaterThan(0);
    expect(result.outcomeLabel).toMatch(/won the clash/i);
  });

  it('REPULSED when force ratio favours defender', () => {
    const result = resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 10,
      seed: deriveCombatSeed('a', 'd', 'drive-repulse'),
      attacker: mixedParticipant(10),
      defender: mixedParticipant(500),
    });
    expect(result.outcome).toBe('REPULSED');
  });

  it('does not label REPULSED when attacker wins force ratio with casualties', () => {
    for (let i = 0; i < 50; i++) {
      const result = resolveCombat({
        attackType: 'DRIVE_BY',
        attackingThugs: 1000,
        seed: deriveCombatSeed('a', 'd', `force-win-${i}`),
        attacker: mixedParticipant(1000),
        defender: mixedParticipant(100),
      });
      const attStr = allocateWeaponsForThugs(1000, standardWeapons(1000)).totalStrength;
      const defStr = allocateWeaponsForThugs(100, standardWeapons(100)).totalStrength;
      if (attStr / defStr >= 1 && result.defenderLosses + result.cartelThugLosses > 0) {
        expect(result.outcome).toBe('SUCCESS');
      }
    }
  });
});

describe('Drive-By monotonicity regression', () => {
  it('stronger attackers stay successful once force advantage is clear', () => {
    const sizes = [250, 500, 1000, 2500];
    const rates = sizes.map((n) => ({ attackingThugs: n, ...driveByRate(n, 500) }));

    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]!.successRate).toBeGreaterThanOrEqual(rates[i - 1]!.successRate - 0.05);
      expect(rates[i]!.repulseRate).toBeLessThanOrEqual(rates[i - 1]!.repulseRate + 0.05);
    }

    expect(rates[0]!.successRate).toBeGreaterThan(0.9);
    expect(rates[rates.length - 1]!.successRate).toBeGreaterThan(0.9);
    expect(rates[rates.length - 1]!.repulseRate).toBeLessThan(0.1);
  });

  it('audit cartel scenario no longer collapses at high attacker counts', () => {
    const mateThugs = [800, 600, 500, 400];
    const responseForce = computeCartelResponseForce(50, 200, 40);
    const virtualSupport = cartelDefenceThugBonus(mateThugs.map((thugs) => ({ thugs })));
    const defender = mixedParticipant(50);
    const sizes = [50, 100, 250, 500, 1000, 2500, 5000];

    const rates = sizes.map((attackingThugs) => {
      let success = 0;
      let repulsed = 0;
      for (let i = 0; i < 400; i++) {
        const result = resolveCombat({
          attackType: 'DRIVE_BY',
          attackingThugs,
          seed: deriveCombatSeed('att', 'def', `cartel-mono-${attackingThugs}-${i}`),
          cartelSupportThugs: virtualSupport,
          cartelArmoury: { thugs: responseForce, glocks: 80, uzis: 40 },
          attacker: mixedParticipant(attackingThugs),
          defender,
        });
        if (result.outcome === 'SUCCESS') success++;
        if (result.outcome === 'REPULSED') repulsed++;
      }
      return { attackingThugs, successRate: success / 400, repulseRate: repulsed / 400 };
    });

    const at1000 = rates.find((r) => r.attackingThugs === 1000)!;
    const at2500 = rates.find((r) => r.attackingThugs === 2500)!;
    expect(at1000.successRate).toBeGreaterThan(0.85);
    expect(at2500.successRate).toBeGreaterThan(0.85);
    expect(at2500.repulseRate).toBeLessThan(0.15);
  });
});

describe('Poach theft isolation', () => {
  it('resolveTheft returns zero cash and drugs for POACH_WORKERS even on victory', () => {
    const rng = createCombatRng(42);
    const theft = resolveTheft(
      'POACH_WORKERS',
      true,
      true,
      500_000,
      largeDrugs,
      90,
      100,
      rng,
    );
    expect(theft.cashStolen).toBe(0);
    expect(theft.drugsStolen).toEqual(emptyDrugs);
  });

  it('successful poach transfers workers without stealing drugs', () => {
    const result = resolveCombat({
      attackType: 'POACH_WORKERS',
      attackingThugs: 400,
      seed: deriveCombatSeed('a', 'd', 'poach-success'),
      attacker: mixedParticipant(400),
      defender: mixedParticipant(100, { drugs: largeDrugs }),
      poachContext: {
        defenderWorkers: 500,
        defenderThugsForProtection: 100,
        workerHappiness: 35,
      },
    });
    expect(result.workersStolen).toBeGreaterThan(0);
    expect(result.cashStolen).toBe(0);
    expect(result.drugsStolen).toEqual(emptyDrugs);
  });

  it('failed poach steals nothing', () => {
    const result = resolveCombat({
      attackType: 'POACH_WORKERS',
      attackingThugs: 20,
      seed: deriveCombatSeed('a', 'd', 'poach-fail'),
      attacker: mixedParticipant(20),
      defender: mixedParticipant(500, { drugs: largeDrugs }),
      poachContext: {
        defenderWorkers: 500,
        defenderThugsForProtection: 500,
        workerHappiness: 80,
      },
    });
    expect(result.workersStolen).toBe(0);
    expect(result.cashStolen).toBe(0);
    expect(result.drugsStolen).toEqual(emptyDrugs);
  });

  it('Drug Raid still steals drugs normally', () => {
    const rng = createCombatRng(99);
    const theft = resolveTheft(
      'RAID_DRUG_LABS',
      true,
      true,
      0,
      largeDrugs,
      90,
      100,
      rng,
    );
    const total =
      theft.drugsStolen.hash +
      theft.drugsStolen.shrooms +
      theft.drugsStolen.coke +
      theft.drugsStolen.heroin;
    expect(total).toBeGreaterThan(0);
  });
});
