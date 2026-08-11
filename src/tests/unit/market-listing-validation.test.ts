import { describe, it, expect } from 'vitest';
import { readPlayerItemQuantity, playerItemIncrement } from '@/lib/game-engine/market-inventory';

describe('market inventory helpers', () => {
  const player = {
    glocks: 0,
    uzis: 0,
    aks: 250,
    rides: 0,
    condoms: 0,
    hash: 0,
    beer: 0,
    shrooms: 0,
    coke: 0,
    heroin: 0,
    prostitutes: 0,
    thugs: 0,
  };

  it('reads AK quantity from player inventory', () => {
    expect(readPlayerItemQuantity(player, 'ak')).toBe(250);
  });

  it('escrows AK quantity via negative increment payload', () => {
    expect(playerItemIncrement('ak', -20)).toEqual({ aks: { increment: -20 } });
  });
});
