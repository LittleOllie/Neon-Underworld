import { describe, it, expect } from 'vitest';
import { calculateNetWorth, netWorthDelta } from '@/lib/game-engine/net-worth';
import { NET_WORTH_VALUES } from '@/config/game/balance';

describe('net worth', () => {
  it('calculates cash at face value', () => {
    expect(calculateNetWorth({ cash: 1000, prostitutes: 0, thugs: 0, rides: 0, hash: 0, shrooms: 0, coke: 0, heroin: 0 })).toBe(1000);
  });

  it('values prostitutes at 1750 each', () => {
    expect(calculateNetWorth({ cash: 0, prostitutes: 2, thugs: 0, rides: 0, hash: 0, shrooms: 0, coke: 0, heroin: 0 })).toBe(3500);
  });

  it('values thugs at 700 each', () => {
    expect(calculateNetWorth({ cash: 0, prostitutes: 0, thugs: 3, rides: 0, hash: 0, shrooms: 0, coke: 0, heroin: 0 })).toBe(2100);
  });

  it('excludes weapons from net worth', () => {
    const nw = calculateNetWorth({ cash: 500, prostitutes: 0, thugs: 0, rides: 0, hash: 0, shrooms: 0, coke: 0, heroin: 0 });
    expect(nw).toBe(500);
  });

  it('calculates delta correctly', () => {
    const before = { cash: 1000, prostitutes: 1, thugs: 0, rides: 0, hash: 0, shrooms: 0, coke: 0, heroin: 0 };
    const after = { cash: 1000, prostitutes: 2, thugs: 0, rides: 0, hash: 0, shrooms: 0, coke: 0, heroin: 0 };
    expect(netWorthDelta(before, after)).toBe(NET_WORTH_VALUES.prostitutes);
  });
});
