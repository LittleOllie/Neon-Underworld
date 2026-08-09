import { describe, it, expect } from 'vitest';
import { ridesRequired } from '@/lib/game-engine/combat/eligibility';

/**
 * Rides represent transport capacity required to launch an attack — not consumable items.
 * combat.service records ridesUsed as committed/required capacity; player.rides is not deducted.
 */
describe('Attack rides — capacity not consumption', () => {
  it('calculates rides required from attacking thug count', () => {
    expect(ridesRequired(50)).toBe(10);
    expect(ridesRequired(5)).toBe(1);
  });
});
