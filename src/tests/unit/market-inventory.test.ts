import { describe, it, expect } from 'vitest';
import {
  readPlayerItemQuantity,
  playerItemIncrement,
} from '@/lib/game-engine/market-inventory';

describe('market-inventory', () => {
  const player = {
    glocks: 10,
    uzis: 0,
    aks: 0,
    rides: 2,
    condoms: 0,
    hash: 0,
    beer: 0,
    shrooms: 0,
    coke: 0,
    heroin: 0,
    prostitutes: 5,
    thugs: 3,
  };

  it('reads shop item quantity', () => {
    expect(readPlayerItemQuantity(player, 'glock')).toBe(10);
  });

  it('reads personnel quantity', () => {
    expect(readPlayerItemQuantity(player, 'whore')).toBe(5);
    expect(readPlayerItemQuantity(player, 'thug')).toBe(3);
  });

  it('playerItemIncrement uses atomic increment, not absolute set', () => {
    expect(playerItemIncrement('glock', 5)).toEqual({ glocks: { increment: 5 } });
    expect(playerItemIncrement('glock', -5)).toEqual({ glocks: { increment: -5 } });
    expect(playerItemIncrement('whore', 2)).toEqual({ prostitutes: { increment: 2 } });
  });
});
