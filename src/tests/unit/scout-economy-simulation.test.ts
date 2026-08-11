import { describe, it, expect } from 'vitest';
import { resolveScouting } from '@/lib/game-engine/scouting';
import { DISTRICTS } from '@/config/game/balance';

const neonModifiers = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;

function monteCarlo(
  turns: number,
  samples: number,
  seedBase: number,
  prostitutes = 100,
) {
  let zeroTotal = 0;
  let workers = 0;
  let thugs = 0;
  for (let i = 0; i < samples; i++) {
    const r = resolveScouting({
      turnsSpent: turns,
      districtModifiers: neonModifiers,
      areaSlug: 'streets',
      prostituteHappiness: 80,
      thugHappiness: 80,
      prostituteCount: prostitutes,
      thugCount: 40,
      prostitutePayoutPercent: 50,
      seed: seedBase + i,
    });
    workers += r.prostitutesFound;
    thugs += r.thugsFound;
    if (r.prostitutesFound + r.thugsFound === 0) zeroTotal++;
  }
  return {
    avgWorkers: workers / samples,
    avgThugs: thugs / samples,
    avgTotal: (workers + thugs) / samples,
    zeroTotalPct: zeroTotal / samples,
  };
}

describe('scout economy simulation', () => {
  it('50 turns averages meaningful recruitment at healthy morale', () => {
    const r = monteCarlo(50, 2000, 40_000);
    expect(r.avgTotal).toBeGreaterThan(3);
    expect(r.avgTotal).toBeLessThan(12);
    expect(r.zeroTotalPct).toBeLessThan(0.03);
  });

  it('100 turns stays in target crew band', () => {
    const r = monteCarlo(100, 1500, 50_000, 10);
    expect(r.avgTotal).toBeGreaterThan(6);
    expect(r.avgTotal).toBeLessThan(20);
  });

  it('scout cash scales down vs large rosters', () => {
    const largeRoster = resolveScouting({
      turnsSpent: 50,
      districtModifiers: neonModifiers,
      areaSlug: 'streets',
      prostituteHappiness: 70,
      thugHappiness: 70,
      prostituteCount: 300,
      thugCount: 180,
      prostitutePayoutPercent: 50,
      seed: 99,
    });
    expect(largeRoster.cashEarned).toBeLessThan(120_000);
  });

  it('maintains split invariance for 1000 turns', () => {
    function splitTotal(parts: number[], seedBase: number) {
      let total = 0;
      for (let s = 0; s < 200; s++) {
        let w = 0;
        let t = 0;
        parts.forEach((turns, idx) => {
          const r = resolveScouting({
            turnsSpent: turns,
            districtModifiers: neonModifiers,
            areaSlug: 'streets',
            prostituteHappiness: 80,
            thugHappiness: 80,
            prostituteCount: 100,
            thugCount: 40,
            prostitutePayoutPercent: 50,
            seed: seedBase + s * 10 + idx,
          });
          w += r.prostitutesFound;
          t += r.thugsFound;
        });
        total += w + t;
      }
      return total / 200;
    }

    const single = splitTotal([1000], 60_000);
    const split10 = splitTotal(Array(10).fill(100), 70_000);
    const mean = (single + split10) / 2;
    expect(Math.abs(single - split10)).toBeLessThan(Math.max(mean * 0.25, 8));
  });
});
