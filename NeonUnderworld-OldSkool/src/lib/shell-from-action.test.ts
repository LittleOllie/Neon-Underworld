import { describe, expect, it } from 'vitest';
import { resolveShellUpdate } from '@local/lib/shell-from-action';

describe('resolveShellUpdate', () => {
  it('prefers explicit shell payload', () => {
    expect(
      resolveShellUpdate({
        shell: { cash: 900, turns: 100, turnCap: 5000, netWorth: 50_000, rank: 3 },
        newCash: 500,
      }),
    ).toEqual({
      cash: 900,
      turns: 100,
      turnCap: 5000,
      netWorth: 50_000,
      rank: 3,
    });
  });

  it('maps action result fields onto shell update', () => {
    expect(
      resolveShellUpdate({
        newCash: 400_000,
        newTurns: 4800,
        canonicalNetWorth: 620_000,
      }),
    ).toEqual({
      cash: 400_000,
      turns: 4800,
      netWorth: 620_000,
    });
  });

  it('falls back to newNetWorth when canonical is absent', () => {
    expect(
      resolveShellUpdate({
        newCash: 100,
        newNetWorth: 200,
      }),
    ).toEqual({
      cash: 100,
      netWorth: 200,
    });
  });
});
