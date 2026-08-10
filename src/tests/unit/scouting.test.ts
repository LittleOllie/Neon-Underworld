import { describe, it, expect } from 'vitest';
import { resolveScouting, validateScoutAmount } from '@/lib/game-engine/scouting';
import {
  happinessEfficiencyModifier,
  calculateDepartureRisk,
  assessScoutWalkoutRisk,
} from '@/lib/game-engine/happiness';
import { createSeededRng, deriveScoutSeed } from '@/lib/game-engine/rng';
import type { DistrictModifiers } from '@/config/game/balance';
import { DISTRICTS } from '@/config/game/balance';
import { REDLITE_SCOUT_AREAS } from '@/config/game/redlite-rules';

const neonModifiers = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;

const defaultModifiers: DistrictModifiers = {
  prostituteRecruitment: 1.0,
  thugRecruitment: 1.0,
  resultConsistency: 1.0,
  descriptionTag: 'test',
};

const defaultInput = {
  districtModifiers: defaultModifiers,
  prostituteHappiness: 70,
  thugHappiness: 70,
  prostituteCount: 5,
  thugCount: 3,
  prostitutePayoutPercent: 50,
};

function scoutTotals(
  turnsSpent: number,
  areaSlug: string,
  seedStart: number,
  samples: number,
) {
  let workers = 0;
  let thugs = 0;
  for (let i = 0; i < samples; i++) {
    const result = resolveScouting({
      ...defaultInput,
      turnsSpent,
      areaSlug,
      seed: seedStart + i,
    });
    workers += result.prostitutesFound;
    thugs += result.thugsFound;
    expect(result.prostitutesFound).toBeGreaterThanOrEqual(0);
    expect(result.thugsFound).toBeGreaterThanOrEqual(0);
  }
  return { workers, thugs };
}

describe('scouting engine', () => {
  it('produces deterministic results with same seed', () => {
    const input = {
      turnsSpent: 100,
      districtModifiers: defaultModifiers,
      prostituteHappiness: 70,
      thugHappiness: 70,
      prostituteCount: 5,
      thugCount: 3,
      prostitutePayoutPercent: 50,
      seed: 12345,
    };
    const a = resolveScouting(input);
    const b = resolveScouting(input);
    expect(a).toEqual(b);
  });

  it('validates scout amounts', () => {
    expect(validateScoutAmount(50, 100).valid).toBe(true);
    expect(validateScoutAmount(200, 100).valid).toBe(false);
    expect(validateScoutAmount(0, 100).valid).toBe(false);
  });

  it('respects district modifiers', () => {
    const neonStrip: DistrictModifiers = { ...defaultModifiers, prostituteRecruitment: 1.12 };
    const docklands: DistrictModifiers = { ...defaultModifiers, prostituteRecruitment: 1.0 };

    let neonTotal = 0;
    let dockTotal = 0;
    for (let i = 0; i < 20; i++) {
      neonTotal += resolveScouting({
        turnsSpent: 200,
        districtModifiers: neonStrip,
        prostituteHappiness: 70,
        thugHappiness: 70,
        prostituteCount: 10,
        thugCount: 5,
        prostitutePayoutPercent: 50,
        seed: i,
      }).prostitutesFound;
      dockTotal += resolveScouting({
        turnsSpent: 200,
        districtModifiers: docklands,
        prostituteHappiness: 70,
        thugHappiness: 70,
        prostituteCount: 10,
        thugCount: 5,
        prostitutePayoutPercent: 50,
        seed: i,
      }).prostitutesFound;
    }
    expect(neonTotal).toBeGreaterThanOrEqual(dockTotal);
  });

  it('derives consistent scout seeds from idempotency key', () => {
    const s1 = deriveScoutSeed('player1', 'key-abc');
    const s2 = deriveScoutSeed('player1', 'key-abc');
    const s3 = deriveScoutSeed('player1', 'key-xyz');
    expect(s1).toBe(s2);
    expect(s1).not.toBe(s3);
  });

  it('generates cash from existing prostitutes scaled by crew happiness', () => {
    const happiness = 70;
    const result = resolveScouting({
      turnsSpent: 100,
      districtModifiers: defaultModifiers,
      prostituteHappiness: happiness,
      thugHappiness: happiness,
      prostituteCount: 10,
      thugCount: 0,
      prostitutePayoutPercent: 0,
      seed: 42,
    });
    const expected = Math.floor(12000 * happinessEfficiencyModifier(happiness));
    expect(result.cashEarned).toBe(expected);
  });
});

describe('scouting balance', () => {
  const turnSpends = [1, 5, 25, 100, 250] as const;
  const samples = 40;

  it('25 turns normally yields meaningful personnel (streets)', () => {
    const { workers, thugs } = scoutTotals(25, 'streets', 1000, samples);
    expect(workers / samples + thugs / samples).toBeGreaterThanOrEqual(0.5);
    expect(workers + thugs).toBeGreaterThan(0);
  });

  it('100 turns yields substantially more than 25 turns', () => {
    const at25 = scoutTotals(25, 'streets', 2000, samples);
    const at100 = scoutTotals(100, 'streets', 2000, samples);
    expect(at100.workers).toBeGreaterThan(at25.workers);
    expect(at100.thugs).toBeGreaterThan(at25.thugs);
  });

  it('turn spend scales recruitment opportunities across representative spends', () => {
    const perTurnWorkers: number[] = [];
    for (const turns of turnSpends) {
      const { workers } = scoutTotals(turns, 'streets', 3000 + turns * 100, samples);
      perTurnWorkers.push(workers / turns / samples);
    }
    expect(perTurnWorkers[perTurnWorkers.length - 1]).toBeGreaterThan(0);
    expect(perTurnWorkers[3]).toBeGreaterThanOrEqual(perTurnWorkers[1]);
  });

  it('streets favours workers over thugs', () => {
    const streets = scoutTotals(250, 'streets', 4000, samples);
    expect(streets.workers).toBeGreaterThan(streets.thugs);
  });

  it('docks favours thugs over workers', () => {
    const docks = scoutTotals(250, 'docks', 5000, samples);
    expect(docks.thugs).toBeGreaterThan(docks.workers);
  });

  it('alleys stays roughly balanced', () => {
    const alleys = scoutTotals(250, 'alleys', 6000, samples);
    const workerShare = alleys.workers / (alleys.workers + alleys.thugs);
    expect(workerShare).toBeGreaterThan(0.35);
    expect(workerShare).toBeLessThan(0.65);
  });

  it('area identity preserved across all scout areas', () => {
    for (const area of REDLITE_SCOUT_AREAS) {
      const { workers, thugs } = scoutTotals(200, area.slug, 7000, 20);
      if (area.prostituteRecruitment > area.thugRecruitment + 0.1) {
        expect(workers).toBeGreaterThan(thugs);
      } else if (area.thugRecruitment > area.prostituteRecruitment + 0.1) {
        expect(thugs).toBeGreaterThan(workers);
      }
    }
  });

  it('never returns negative personnel or losses beyond roster', () => {
    const result = resolveScouting({
      ...defaultInput,
      turnsSpent: 250,
      areaSlug: 'streets',
      prostituteCount: 2,
      thugCount: 1,
      prostituteHappiness: 80,
      thugHappiness: 80,
      seed: 8888,
    });
    expect(result.prostitutesFound).toBeGreaterThanOrEqual(0);
    expect(result.thugsFound).toBeGreaterThanOrEqual(0);
    expect(result.prostitutesLost).toBeGreaterThanOrEqual(0);
    expect(result.thugsLost).toBeGreaterThanOrEqual(0);
    expect(result.prostitutesLost).toBeLessThanOrEqual(2);
    expect(result.thugsLost).toBeLessThanOrEqual(1);
  });
});

function splitRecruitment(parts: number[], seedBase: number, samples = 80) {
  let totalWorkers = 0;
  let totalThugs = 0;
  for (let s = 0; s < samples; s++) {
    let workers = 0;
    let thugs = 0;
    parts.forEach((turns, idx) => {
      const result = resolveScouting({
        turnsSpent: turns,
        districtModifiers: neonModifiers,
        areaSlug: 'streets',
        prostituteHappiness: 80,
        thugHappiness: 80,
        prostituteCount: 100,
        thugCount: 40,
        prostitutePayoutPercent: 50,
        seed: seedBase + s * 100 + idx,
      });
      workers += result.prostitutesFound;
      thugs += result.thugsFound;
    });
    totalWorkers += workers;
    totalThugs += thugs;
  }
  return { avgWorkers: totalWorkers / samples, avgThugs: totalThugs / samples };
}

describe('scouting split invariance', () => {
  it('does not reward splitting 1000 turns into smaller scouts', () => {
    const single = splitRecruitment([1000], 50_000);
    const split10 = splitRecruitment(Array(10).fill(100), 60_000);
    const split20 = splitRecruitment(Array(20).fill(50), 70_000);

    const workerMean = (single.avgWorkers + split10.avgWorkers + split20.avgWorkers) / 3;
    const workerTolerance = Math.max(workerMean * 0.25, 8);

    expect(Math.abs(single.avgWorkers - split10.avgWorkers)).toBeLessThanOrEqual(workerTolerance);
    expect(Math.abs(single.avgWorkers - split20.avgWorkers)).toBeLessThanOrEqual(workerTolerance);
  });

  it('100 turns yields roughly 5–10 workers at healthy morale (streets)', () => {
    let workers = 0;
    const samples = 60;
    for (let i = 0; i < samples; i++) {
      workers += resolveScouting({
        turnsSpent: 100,
        districtModifiers: neonModifiers,
        areaSlug: 'streets',
        prostituteHappiness: 80,
        thugHappiness: 80,
        prostituteCount: 10,
        thugCount: 5,
        prostitutePayoutPercent: 50,
        seed: 80_000 + i,
      }).prostitutesFound;
    }
    const avg = workers / samples;
    expect(avg).toBeGreaterThanOrEqual(3);
    expect(avg).toBeLessThanOrEqual(12);
  });
});

describe('walkout risk assessment', () => {
  it('warns on critical morale for large scouts', () => {
    const risk = assessScoutWalkoutRisk(500, 29, 29, 200, 40);
    expect(risk.level).toBe('critical');
  });

  it('warns on critical morale for large produce actions', () => {
    const risk = assessScoutWalkoutRisk(500, 29, 29, 200, 40);
    expect(risk.message).toMatch(/large action/i);
  });

  it('caps walkouts to a fraction of crew per action', () => {
    let maxLost = 0;
    for (let i = 0; i < 40; i++) {
      const result = calculateDepartureRisk(1000, 29, 29, 200, 40, createSeededRng(i));
      maxLost = Math.max(maxLost, result.prostitutesLost);
      expect(result.prostitutesLost).toBeLessThanOrEqual(50);
    }
    expect(maxLost).toBeGreaterThan(0);
  });
});

describe('seeded RNG', () => {
  it('produces reproducible sequence', () => {
    const a = createSeededRng(999);
    const b = createSeededRng(999);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });
});
