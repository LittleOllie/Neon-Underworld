import { describe, expect, it } from 'vitest';
import {
  assignNpcAvatar,
  IMPORTANT_NPC_AVATARS,
  isNpcManagedAccount,
  NPC_ASSIGNABLE_AVATAR_IDS,
  npcAvatarNeedsBackfill,
} from '@/lib/game-engine/npc-avatar';
import { DEFAULT_PLAYER_AVATAR_ID } from '@/config/game/player-avatars';

describe('assignNpcAvatar', () => {
  it('is deterministic for the same stable identifier', () => {
    expect(assignNpcAvatar('rustrunner')).toBe(assignNpcAvatar('RustRunner'));
    expect(assignNpcAvatar('neonstrip01')).toBe(assignNpcAvatar('neonstrip01'));
  });

  it('assigns different avatars across identifiers before excessive repetition', () => {
    const ids = new Set(
      Array.from({ length: 40 }, (_, i) => assignNpcAvatar(`playtest-npc-${i}`)),
    );
    expect(ids.size).toBeGreaterThan(8);
  });

  it('uses important NPC overrides when defined', () => {
    for (const [alias, avatarId] of Object.entries(IMPORTANT_NPC_AVATARS)) {
      expect(assignNpcAvatar(alias)).toBe(avatarId);
    }
  });

  it('falls back safely for empty input', () => {
    expect(assignNpcAvatar('')).toBe(DEFAULT_PLAYER_AVATAR_ID);
    expect(assignNpcAvatar('   ')).toBe(DEFAULT_PLAYER_AVATAR_ID);
  });

  it('only returns canonical avatar ids', () => {
    for (let i = 0; i < 100; i++) {
      const id = assignNpcAvatar(`npc-${i}`);
      expect(NPC_ASSIGNABLE_AVATAR_IDS).toContain(id);
    }
  });
});

describe('isNpcManagedAccount', () => {
  it('identifies system and seeded opponent accounts', () => {
    expect(isNpcManagedAccount({ isSystemPlayer: true, email: 'simon@example.com' })).toBe(true);
    expect(isNpcManagedAccount({ isSystemPlayer: false, email: 'system+vex@neonunderworld.local' })).toBe(
      true,
    );
    expect(
      isNpcManagedAccount({ isSystemPlayer: false, email: 'playtest-npc+rustrunner@neonunderworld.local' }),
    ).toBe(true);
    expect(
      isNpcManagedAccount({ isSystemPlayer: false, email: 'dev-pvp+neonviper@neonunderworld.local' }),
    ).toBe(true);
  });

  it('does not treat normal human accounts as NPC-managed', () => {
    expect(isNpcManagedAccount({ isSystemPlayer: false, email: 'player@example.com' })).toBe(false);
    expect(isNpcManagedAccount({ isSystemPlayer: false, email: 'admin@neonunderworld.local' })).toBe(
      false,
    );
  });
});

describe('npcAvatarNeedsBackfill', () => {
  it('flags null, invalid, and default viper for NPC backfill', () => {
    expect(npcAvatarNeedsBackfill(null)).toBe(true);
    expect(npcAvatarNeedsBackfill('')).toBe(true);
    expect(npcAvatarNeedsBackfill('legacy-face')).toBe(true);
    expect(npcAvatarNeedsBackfill(DEFAULT_PLAYER_AVATAR_ID)).toBe(true);
  });

  it('preserves valid non-default avatars', () => {
    expect(npcAvatarNeedsBackfill('ghost')).toBe(false);
    expect(npcAvatarNeedsBackfill('siren')).toBe(false);
  });
});

describe('human player safety (backfill eligibility)', () => {
  it('leaves human-chosen avatars untouched by backfill predicate', () => {
    const human = {
      isSystemPlayer: false,
      email: 'simon@example.com',
      avatar: 'cherry' as const,
    };

    expect(isNpcManagedAccount(human)).toBe(false);
    expect(npcAvatarNeedsBackfill(human.avatar)).toBe(false);
  });

  it('assigns NPC with empty avatar but not human with chosen avatar', () => {
    const human = { isSystemPlayer: false, email: 'simon@example.com', avatar: 'cherry' };
    const npc = { isSystemPlayer: false, email: 'dev-pvp+rustrunner@neonunderworld.local', avatar: null };

    const humanWouldUpdate =
      isNpcManagedAccount(human) && npcAvatarNeedsBackfill(human.avatar);
    const npcWouldUpdate = isNpcManagedAccount(npc) && npcAvatarNeedsBackfill(npc.avatar);

    expect(humanWouldUpdate).toBe(false);
    expect(npcWouldUpdate).toBe(true);
    expect(assignNpcAvatar('rustrunner')).toBe('razor');
  });
});

describe('seed rerun consistency', () => {
  it('produces identical avatar assignments across repeated seed resolution', () => {
    const aliases = ['Vex_Morgan', 'SilkRunner', 'NeonRunner01', 'DockWolf02'];
    const first = aliases.map((alias) => assignNpcAvatar(alias.toLowerCase()));
    const second = aliases.map((alias) => assignNpcAvatar(alias.toLowerCase()));
    expect(second).toEqual(first);
  });
});
