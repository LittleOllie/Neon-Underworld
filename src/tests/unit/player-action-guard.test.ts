import { describe, it, expect } from 'vitest';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';

describe('assertPlayerCanPerformAction', () => {
  it('allows active non-travelling players', () => {
    expect(() =>
      assertPlayerCanPerformAction({ lifeStatus: 'ACTIVE', travelling: false }),
    ).not.toThrow();
  });

  it('blocks travelling players', () => {
    expect(() =>
      assertPlayerCanPerformAction({ lifeStatus: 'ACTIVE', travelling: true }),
    ).toThrow(GameplayError);
    try {
      assertPlayerCanPerformAction({ lifeStatus: 'ACTIVE', travelling: true });
    } catch (e) {
      expect((e as GameplayError).gameplayCode).toBe('PLAYER_TRAVELLING');
    }
  });

  it('blocks incapacitated life statuses', () => {
    expect(() =>
      assertPlayerCanPerformAction({ lifeStatus: 'HOSPITALIZED', travelling: false }),
    ).toThrow(GameplayError);
    try {
      assertPlayerCanPerformAction({ lifeStatus: 'JAIL', travelling: false });
    } catch (e) {
      expect((e as GameplayError).gameplayCode).toBe('PLAYER_INCAPACITATED');
    }
  });
});
