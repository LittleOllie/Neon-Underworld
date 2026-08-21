import { describe, expect, it } from 'vitest';
import {
  needsIdentitySetup,
  resolvePlayerIdentity,
} from '@/lib/game-engine/player-identity';
import { NU_DEFAULT_THEME } from '@/config/game/nu-default-theme';

describe('player-identity', () => {
  it('requires setup when avatarSource is null', () => {
    expect(needsIdentitySetup({ avatarSource: null })).toBe(true);
    expect(needsIdentitySetup({ avatarSource: 'CHARACTER' })).toBe(false);
  });

  it('resolves uploaded PFP image source', () => {
    const resolved = resolvePlayerIdentity({
      avatar: null,
      avatarSource: 'UPLOAD',
      pfpUrl: '/api/player-pfp/p1/test.png',
      themePrimary: '#ff1493',
      themeSecondary: '#6a0dad',
    });
    expect(resolved.imageSrc).toBe('/api/player-pfp/p1/test.png');
    expect(resolved.avatarId).toBeNull();
  });

  it('falls back to NU default theme without custom colours', () => {
    const resolved = resolvePlayerIdentity({
      avatar: 'viper',
      avatarSource: 'UPLOAD',
      pfpUrl: '/api/player-pfp/p1/test.png',
      themePrimary: null,
      themeSecondary: null,
    });
    expect(resolved.theme.primary).toBe(NU_DEFAULT_THEME.primary);
  });

  it('uses character theme when no custom colours set', () => {
    const resolved = resolvePlayerIdentity({
      avatar: 'raven',
      avatarSource: 'CHARACTER',
      pfpUrl: null,
      themePrimary: null,
      themeSecondary: null,
    });
    expect(resolved.imageSrc).toBe('/avatars/raven.png');
    expect(resolved.theme.primary).toBe('#6a0dad');
  });
});
