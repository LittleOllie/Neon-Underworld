import { describe, expect, it } from 'vitest';
import { districtSlugForLadderSlot } from '@/lib/game-engine/playtest-npc-districts';

describe('playtest NPC district spread', () => {
  it('gives each district low and high ladder slots', () => {
    const byDistrict = { 'neon-strip': [] as number[], docklands: [] as number[], 'old-quarter': [] as number[] };
    for (let slot = 0; slot < 50; slot++) {
      const slug = districtSlugForLadderSlot(slot);
      byDistrict[slug].push(slot);
    }
    for (const slots of Object.values(byDistrict)) {
      expect(slots.some((s) => s < 6)).toBe(true);
      expect(slots.some((s) => s >= 34)).toBe(true);
    }
  });
});
