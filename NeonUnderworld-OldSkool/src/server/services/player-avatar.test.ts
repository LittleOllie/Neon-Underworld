import { describe, expect, it } from 'vitest';
import { resolvePlayerAvatarId } from '@core/lib/game-engine/resolve-player-avatar';

describe('rankings avatar serialization', () => {
  it('maps missing player avatar to viper for display', () => {
    const avatarId = resolvePlayerAvatarId(null);
    expect(avatarId).toBe('viper');
  });

  it('preserves explicit avatar ids', () => {
    expect(resolvePlayerAvatarId('siren')).toBe('siren');
  });
});
