'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  FOUNDING_PLAYER_AVATARS_BY_COLOR,
  type PlayerAvatarId,
} from '@core/config/game/player-avatars';
import {
  avatarThemeCssVars,
  resolvePlayerAvatarConfig,
} from '@core/lib/game-engine/resolve-player-avatar';
import { PlayerAvatar } from '@local/components/game/PlayerAvatar';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { setPlayerAvatarAction } from '@local/server/actions/player-avatar.actions';

export interface AvatarSelectionClientProps {
  alias: string;
  initialAvatarId?: PlayerAvatarId | null;
  mode: 'onboarding' | 'settings';
  returnTo?: string;
}

export function AvatarSelectionClient({
  alias,
  initialAvatarId = null,
  mode,
  returnTo = '/command',
}: AvatarSelectionClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<PlayerAvatarId>(
    initialAvatarId ?? 'viper',
  );
  const [error, setError] = useState('');

  const previewConfig = useMemo(
    () => resolvePlayerAvatarConfig(selectedId),
    [selectedId],
  );

  const themeStyle = useMemo(
    () => avatarThemeCssVars(previewConfig),
    [previewConfig],
  );

  useEffect(() => {
    document.documentElement.classList.add('nu-identity-select');
    return () => document.documentElement.classList.remove('nu-identity-select');
  }, []);

  function handleConfirm() {
    setError('');
    startTransition(async () => {
      const result = await setPlayerAvatarAction(selectedId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(returnTo);
      router.refresh();
    });
  }

  const title =
    mode === 'onboarding' ? 'CHOOSE YOUR FACE IN THE UNDERWORLD' : 'CHANGE YOUR IDENTITY';
  const subtitle =
    mode === 'onboarding'
      ? 'Your face. Your colours. Your reputation.'
      : 'Pick a new portrait and accent. Your alias stays the same.';
  const cta = mode === 'onboarding' ? 'CLAIM THIS IDENTITY' : 'SAVE IDENTITY';

  function avatarOptionStyle(config: (typeof FOUNDING_PLAYER_AVATARS_BY_COLOR)[number]): React.CSSProperties {
    return {
      '--option-accent-primary': config.primary,
      '--option-accent-secondary': config.secondary,
      '--option-accent-glow': config.glow,
      '--option-accent-muted': config.muted,
    } as React.CSSProperties;
  }

  return (
    <div
      className="g-identity-select nu-glitch-surface"
      style={themeStyle as React.CSSProperties}
      data-avatar-theme={selectedId}
    >
      <header className="g-identity-select__header">
        <p className="g-identity-select__eyebrow">NEON UNDERWORLD</p>
        <h1 className="g-identity-select__title">{title}</h1>
        <p className="g-identity-select__subtitle">{subtitle}</p>
      </header>

      <div className="g-identity-select__preview">
        <p className="g-identity-select__alias">{alias}</p>
        <PlayerAvatar
          avatarId={selectedId}
          alt={alias}
          size="xl"
          shape="circle"
          priority
        />
      </div>

      <div className="g-identity-select__grid" role="listbox" aria-label="Choose avatar">
        {FOUNDING_PLAYER_AVATARS_BY_COLOR.map((avatar) => {
          const isSelected = avatar.id === selectedId;
          return (
            <button
              key={avatar.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`g-identity-select__option${isSelected ? ' g-identity-select__option--active' : ''}`}
              style={avatarOptionStyle(avatar)}
              onClick={() => setSelectedId(avatar.id)}
            >
              <PlayerAvatar avatarId={avatar.id} alt={avatar.name} size="identity" />
            </button>
          );
        })}
      </div>

      {error && (
        <p className="g-auth-error" role="alert">
          {error}
        </p>
      )}

      <div className="g-identity-select__actions">
        <PrimaryButton
          type="button"
          className="g-btn-full"
          pending={pending}
          onClick={handleConfirm}
        >
          {cta}
        </PrimaryButton>
        {mode === 'settings' && (
          <button
            type="button"
            className="g-btn g-btn-secondary g-btn-full"
            disabled={pending}
            onClick={() => router.push('/settings')}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
