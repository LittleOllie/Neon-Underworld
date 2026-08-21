import { describe, it, expect } from 'vitest';
import { isHumanPlayer, isVisibleSeasonParticipant } from '@/lib/game-engine/human-player';

describe('isHumanPlayer', () => {
  it('excludes system players', () => {
    expect(isHumanPlayer({ isSystemPlayer: true, email: 'system+npc@neonunderworld.local' })).toBe(false);
  });

  it('excludes playtest NPC accounts', () => {
    expect(
      isHumanPlayer({ isSystemPlayer: false, email: 'playtest-npc+runner01@neonunderworld.local' }),
    ).toBe(false);
  });

  it('excludes dev-pvp NPC accounts', () => {
    expect(isHumanPlayer({ isSystemPlayer: false, email: 'dev-pvp+ghost@neonunderworld.local' })).toBe(false);
  });

  it('excludes local-npc fixture accounts', () => {
    expect(
      isHumanPlayer({ isSystemPlayer: false, email: 'local-npc+fixneonrunner01@neonunderworld.local' }),
    ).toBe(false);
  });

  it('includes normal human registrations', () => {
    expect(isHumanPlayer({ isSystemPlayer: false, email: 'player@example.com' })).toBe(true);
  });
});

describe('isVisibleSeasonParticipant', () => {
  const activated = new Set(['human-1']);

  it('shows all players when activation is not enforced', () => {
    expect(
      isVisibleSeasonParticipant(
        { id: 'npc-1', isSystemPlayer: false, email: 'local-npc+fixneonrunner01@neonunderworld.local' },
        null,
      ),
    ).toBe(true);
  });

  it('always shows NPC fixtures when activation is enforced', () => {
    expect(
      isVisibleSeasonParticipant(
        { id: 'npc-1', isSystemPlayer: false, email: 'local-npc+fixneonrunner01@neonunderworld.local' },
        activated,
      ),
    ).toBe(true);
  });

  it('hides unactivated humans when activation is enforced', () => {
    expect(
      isVisibleSeasonParticipant({ id: 'human-2', isSystemPlayer: false, email: 'player@example.com' }, activated),
    ).toBe(false);
  });

  it('shows activated humans when activation is enforced', () => {
    expect(
      isVisibleSeasonParticipant({ id: 'human-1', isSystemPlayer: false, email: 'player@example.com' }, activated),
    ).toBe(true);
  });
});
