/** Deterministic seeded pseudo-random number generator (Mulberry32) */
export function createSeededRng(seed: number) {
  let state = seed >>> 0;

  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    nextFloat(min: number, max: number): number {
      return min + this.next() * (max - min);
    },
  };
}

export function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deriveScoutSeed(playerId: string, idempotencyKey: string): number {
  return hashStringToSeed(`${playerId}:${idempotencyKey}`);
}
