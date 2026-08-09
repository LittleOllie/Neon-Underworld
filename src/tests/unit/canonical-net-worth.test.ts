import { describe, it, expect } from 'vitest';
import {
  calculateCanonicalNetWorth,
  calculateCanonicalNetWorthFromPlayer,
} from '@/lib/game-engine/canonical-net-worth';

describe('calculateCanonicalNetWorth', () => {
  const basePlayer = {
    cash: 10_000,
    bankCash: 5_000,
    thugs: 10,
    prostitutes: 4,
    rides: 2,
    hash: 100,
    shrooms: 0,
    coke: 0,
    heroin: 0,
  };

  it('includes cash, bank, personnel, vehicles, and drugs', () => {
    const nw = calculateCanonicalNetWorthFromPlayer(basePlayer);
    // 10000 + 5000 + 7000 + 7000 + 4000 + 500
    expect(nw).toBe(10_000 + 5_000 + 7_000 + 7_000 + 4_000 + 500);
  });

  it('returns identical NW for same snapshot via both entry points', () => {
    const fromPlayer = calculateCanonicalNetWorthFromPlayer(basePlayer);
    const fromInput = calculateCanonicalNetWorth({
      cash: basePlayer.cash,
      bankCash: basePlayer.bankCash,
      thugs: basePlayer.thugs,
      workers: basePlayer.prostitutes,
      vehicles: basePlayer.rides,
      drugs: basePlayer.hash,
    });
    expect(fromPlayer).toBe(fromInput);
  });

  it('matches attack eligibility calculator input shape', () => {
    const attacker = { ...basePlayer, id: 'a1' };
    const defender = { ...basePlayer, cash: 20_000, id: 'd1' };
    const attackerNw = calculateCanonicalNetWorthFromPlayer(attacker);
    const defenderNw = calculateCanonicalNetWorthFromPlayer(defender);
    expect(attackerNw).not.toBe(defenderNw);
    expect(attackerNw).toBe(calculateCanonicalNetWorthFromPlayer(attacker));
  });
});
