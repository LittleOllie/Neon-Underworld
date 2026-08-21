import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYER_AVATAR_ID,
  FOUNDING_PLAYER_AVATARS,
  FOUNDING_PLAYER_AVATARS_BY_COLOR,
  avatarPrimaryHsl,
  getPlayerAvatarConfig,
  isPlayerAvatarId,
} from '@/config/game/player-avatars';
import {
  needsAvatarSelection,
  resolvePlayerAvatarConfig,
  resolvePlayerAvatarId,
} from '@/lib/game-engine/resolve-player-avatar';

describe('player avatars', () => {
  it('registers all 20 founding avatars', () => {
    expect(FOUNDING_PLAYER_AVATARS).toHaveLength(20);
    expect(FOUNDING_PLAYER_AVATARS.every((avatar) => avatar.category === 'founding')).toBe(true);
    expect(FOUNDING_PLAYER_AVATARS.every((avatar) => avatar.locked === false)).toBe(true);
  });

  it('falls back missing or invalid avatar ids to Viper', () => {
    expect(resolvePlayerAvatarId(null)).toBe(DEFAULT_PLAYER_AVATAR_ID);
    expect(resolvePlayerAvatarId(undefined)).toBe('viper');
    expect(resolvePlayerAvatarId('')).toBe('viper');
    expect(resolvePlayerAvatarId('not-a-character')).toBe('viper');
  });

  it('resolves known avatar ids', () => {
    expect(resolvePlayerAvatarId('ghost')).toBe('ghost');
    expect(resolvePlayerAvatarConfig('ghost').name).toBe('Ghost');
    expect(getPlayerAvatarConfig('ghost').imagePath).toBe('/avatars/ghost.png');
  });

  it('detects when avatar selection is required', () => {
    expect(needsAvatarSelection(null)).toBe(true);
    expect(needsAvatarSelection('')).toBe(true);
    expect(needsAvatarSelection('viper')).toBe(false);
  });

  it('validates avatar ids', () => {
    expect(isPlayerAvatarId('cherry')).toBe(true);
    expect(isPlayerAvatarId('fake')).toBe(false);
  });

  it('orders identity grid avatars by similar hue across the palette', () => {
    expect(FOUNDING_PLAYER_AVATARS_BY_COLOR).toHaveLength(20);
    expect(new Set(FOUNDING_PLAYER_AVATARS_BY_COLOR.map((a) => a.id)).size).toBe(20);

    const hsl = FOUNDING_PLAYER_AVATARS_BY_COLOR.map((a) => avatarPrimaryHsl(a.primary));
    const chromatic = hsl.filter((c) => c.chroma >= 0.1);
    for (let i = 1; i < chromatic.length; i++) {
      expect(chromatic[i].h).toBeGreaterThanOrEqual(chromatic[i - 1].h);
    }

    const lastTwo = FOUNDING_PLAYER_AVATARS_BY_COLOR.slice(-2).map((a) => a.id);
    expect(lastTwo).toContain('grimm');
    expect(lastTwo).toContain('siren');
  });
});
