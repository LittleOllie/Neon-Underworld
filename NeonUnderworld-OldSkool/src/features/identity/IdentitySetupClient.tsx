'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlayerAvatarSource } from '@prisma/client';
import {
  FOUNDING_PLAYER_AVATARS_BY_COLOR,
  type PlayerAvatarId,
} from '@core/config/game/player-avatars';
import { extractAccentColorsFromImageFile } from '@core/lib/game-engine/extract-accent-colors';
import {
  characterThemeFromAvatarId,
  playerIdentityCssVars,
  resolvePlayerIdentity,
  type PlayerIdentityRecord,
} from '@core/lib/game-engine/player-identity';
import { buildThemePalette, themePaletteToCssVars } from '@core/lib/game-engine/theme-safety';
import { PlayerAvatar } from '@local/components/game/PlayerAvatar';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { setPlayerIdentityAction } from '@local/server/actions/player-identity.actions';
import {
  NU_DEFAULT_THEME,
  sanitizeThemeInput,
  ThemeColorControls,
} from '@local/features/identity/ThemeColorControls';

type IdentityMode = 'character' | 'upload';

export interface IdentitySetupClientProps {
  alias: string;
  initial: PlayerIdentityRecord;
  flow: 'onboarding' | 'settings';
  returnTo?: string;
}

export function IdentitySetupClient({
  alias,
  initial,
  flow,
  returnTo = '/command',
}: IdentitySetupClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [mode, setMode] = useState<IdentityMode>(
    initial.avatarSource === 'UPLOAD' ? 'upload' : 'character',
  );
  const [selectedId, setSelectedId] = useState<PlayerAvatarId>(
    (initial.avatar as PlayerAvatarId) ?? 'viper',
  );
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(initial.pfpUrl);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(initial.pfpUrl);
  const [uploading, setUploading] = useState(false);
  const [customizing, setCustomizing] = useState(
    Boolean(initial.themePrimary && initial.themeSecondary),
  );
  const [suggestedTheme, setSuggestedTheme] = useState({
    primary: initial.themePrimary ?? NU_DEFAULT_THEME.primary,
    secondary: initial.themeSecondary ?? NU_DEFAULT_THEME.secondary,
  });
  const [primary, setPrimary] = useState(
    initial.themePrimary ?? characterThemeFromAvatarId(selectedId).primary,
  );
  const [secondary, setSecondary] = useState(
    initial.themeSecondary ?? characterThemeFromAvatarId(selectedId).secondary,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrl = useRef<string | null>(null);

  const previewIdentity: PlayerIdentityRecord = useMemo(() => {
    if (mode === 'upload' && uploadedUrl) {
      return {
        avatar: null,
        avatarSource: 'UPLOAD',
        pfpUrl: uploadPreviewUrl ?? uploadedUrl,
        themePrimary: primary,
        themeSecondary: secondary,
      };
    }
    return {
      avatar: selectedId,
      avatarSource: 'CHARACTER',
      pfpUrl: null,
      themePrimary: customizing ? primary : null,
      themeSecondary: customizing ? secondary : null,
    };
  }, [mode, selectedId, uploadedUrl, uploadPreviewUrl, primary, secondary, customizing]);

  const themeStyle = useMemo(
    () =>
      themePaletteToCssVars(
        buildThemePalette(primary, secondary),
      ) as React.CSSProperties,
    [primary, secondary],
  );

  useEffect(() => {
    document.documentElement.classList.add('nu-identity-select');
    return () => {
      document.documentElement.classList.remove('nu-identity-select');
      if (previewObjectUrl.current) {
        URL.revokeObjectURL(previewObjectUrl.current);
      }
    };
  }, []);

  function applyCharacterTheme(id: PlayerAvatarId) {
    const theme = characterThemeFromAvatarId(id);
    setSuggestedTheme({ primary: theme.primary, secondary: theme.secondary });
    if (!customizing) {
      setPrimary(theme.primary);
      setSecondary(theme.secondary);
    }
  }

  function selectCharacter(id: PlayerAvatarId) {
    setSelectedId(id);
    setMode('character');
    applyCharacterTheme(id);
  }

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      if (previewObjectUrl.current) {
        URL.revokeObjectURL(previewObjectUrl.current);
      }
      const objectUrl = URL.createObjectURL(file);
      previewObjectUrl.current = objectUrl;
      setUploadPreviewUrl(objectUrl);
      setMode('upload');

      const extracted = await extractAccentColorsFromImageFile(file);
      setSuggestedTheme({ primary: extracted.primary, secondary: extracted.secondary });
      setPrimary(extracted.primary);
      setSecondary(extracted.secondary);
      setCustomizing(false);

      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/player-pfp/upload', { method: 'POST', body });
      const json = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !json.url) {
        setError(json.error ?? 'Upload failed.');
        return;
      }
      setUploadedUrl(json.url);
      setUploadPreviewUrl(json.url);
    } catch {
      setError('Upload failed. Try a smaller PNG, JPEG, or WEBP.');
    } finally {
      setUploading(false);
    }
  }

  async function reExtractFromUpload() {
    if (!uploadPreviewUrl) return;
    try {
      const response = await fetch(uploadPreviewUrl);
      const blob = await response.blob();
      const extracted = await extractAccentColorsFromImageFile(blob);
      setSuggestedTheme({ primary: extracted.primary, secondary: extracted.secondary });
      setPrimary(extracted.primary);
      setSecondary(extracted.secondary);
    } catch {
      setError('Could not read colours from your PFP.');
    }
  }

  function openFilePicker() {
    setMode('upload');
    fileInputRef.current?.click();
  }

  function handleConfirm() {
    setError('');
    const theme = sanitizeThemeInput(primary, secondary);
    if (!theme) {
      setError('Choose valid primary and secondary colours.');
      return;
    }

    startTransition(async () => {
      if (mode === 'upload') {
        if (!uploadedUrl) {
          setError('Upload a profile image first.');
          return;
        }
        const result = await setPlayerIdentityAction({
          source: 'UPLOAD',
          pfpUrl: uploadedUrl,
          themePrimary: theme.primary,
          themeSecondary: theme.secondary,
        });
        if (!result.success) {
          setError(result.error);
          return;
        }
      } else {
        const result = await setPlayerIdentityAction({
          source: 'CHARACTER',
          avatarId: selectedId,
          themePrimary: customizing ? theme.primary : null,
          themeSecondary: customizing ? theme.secondary : null,
          useCharacterTheme: !customizing,
        });
        if (!result.success) {
          setError(result.error);
          return;
        }
      }
      router.push(returnTo);
      router.refresh();
    });
  }

  const title =
    flow === 'onboarding' ? 'CHOOSE YOUR IDENTITY' : 'CHANGE YOUR IDENTITY';
  const subtitle =
    flow === 'onboarding'
      ? 'Your face. Your colours. Your reputation.'
      : 'Update your portrait and accent theme. Your alias stays the same.';
  const cta = flow === 'onboarding' ? 'ENTER THE UNDERWORLD' : 'SAVE IDENTITY';

  function avatarOptionStyle(config: (typeof FOUNDING_PLAYER_AVATARS_BY_COLOR)[number]): React.CSSProperties {
    return {
      '--option-accent-primary': config.primary,
      '--option-accent-secondary': config.secondary,
      '--option-accent-glow': config.glow,
      '--option-accent-muted': config.muted,
    } as React.CSSProperties;
  }

  return (
    <div className="g-gameplay-controls g-identity-chrome">
    <div
      className="g-identity-select"
      style={themeStyle}
      data-avatar-theme={mode === 'character' ? selectedId : 'upload'}
    >
      <header className="g-identity-select__header">
        <p className="g-identity-select__eyebrow">NEON UNDERWORLD</p>
        <h1 className="g-identity-select__title">{title}</h1>
        <p className="g-identity-select__subtitle">{subtitle}</p>
      </header>

      <div className="g-identity-select__preview">
        <p className="g-identity-select__alias">{alias}</p>
        <PlayerAvatar
          identity={previewIdentity}
          alt={alias}
          size="identity"
          shape="square"
          priority
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="g-identity-upload__input"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
      />

      <div className="g-filter-row g-identity-mode" role="tablist" aria-label="Identity type">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'character'}
          className={`g-filter${mode === 'character' ? ' g-filter-active' : ''}`}
          onClick={() => setMode('character')}
        >
          NU Character
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'upload'}
          className={`g-filter${mode === 'upload' ? ' g-filter-active' : ''}`}
          onClick={openFilePicker}
        >
          Upload PFP
        </button>
      </div>

      {mode === 'character' ? (
        <div className="g-identity-select__grid" role="listbox" aria-label="Choose NU character">
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
                onClick={() => selectCharacter(avatar.id)}
              >
                <PlayerAvatar avatarId={avatar.id} alt={avatar.name} size="identity" shape="square" />
              </button>
            );
          })}
        </div>
      ) : (
        <section className="g-identity-upload" aria-label="Upload profile image">
          <p className="g-note">
            Your PFP is visible to other Operators. PNG, JPEG, or WEBP — max 2 MB.
          </p>
          <div className="g-identity-upload__actions">
            <PrimaryButton
              type="button"
              variant="secondary"
              pending={uploading}
              onClick={openFilePicker}
            >
              {uploadPreviewUrl ? 'Replace image' : 'Choose image'}
            </PrimaryButton>
            {uploadPreviewUrl ? (
              <button
                type="button"
                className="g-btn g-btn-secondary"
                disabled={uploading || pending}
                onClick={() => void reExtractFromUpload()}
              >
                Auto-extract colours
              </button>
            ) : null}
          </div>
        </section>
      )}

      <ThemeColorControls
        primary={primary}
        secondary={secondary}
        customizing={customizing}
        disabled={pending || uploading}
        onPrimaryChange={setPrimary}
        onSecondaryChange={setSecondary}
        onUseSuggested={() => {
          setPrimary(suggestedTheme.primary);
          setSecondary(suggestedTheme.secondary);
          setCustomizing(false);
        }}
        onCustomize={() => setCustomizing(true)}
        onResetDefault={() => {
          setPrimary(NU_DEFAULT_THEME.primary);
          setSecondary(NU_DEFAULT_THEME.secondary);
          setSuggestedTheme({ primary: NU_DEFAULT_THEME.primary, secondary: NU_DEFAULT_THEME.secondary });
          setCustomizing(true);
        }}
      />

      {error && (
        <p className="g-auth-error" role="alert">
          {error}
        </p>
      )}

      <div className="g-identity-select__actions">
        <PrimaryButton
          type="button"
          className="g-btn-full"
          pending={pending || uploading}
          onClick={handleConfirm}
        >
          {cta}
        </PrimaryButton>
        {flow === 'settings' && (
          <button
            type="button"
            className="g-btn g-btn-secondary g-btn-full"
            disabled={pending || uploading}
            onClick={() => router.push('/settings')}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
    </div>
  );
}
