/** Injectable seeded RNG for deterministic combat tests */

export interface CombatRng {
  next(): number;
}

export function createCombatRng(seed: number): CombatRng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}

export function varianceMultiplier(rng: CombatRng, min: number, max: number): number {
  return min + rng.next() * (max - min);
}
