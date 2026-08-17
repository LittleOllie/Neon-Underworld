/** Boot / intro screen assets and copy helpers. */

/** Viewport width at or below which portrait phone intro art is used. */
export const BOOT_PHONE_MAX_WIDTH = 768;

export const BOOT_SCREEN = {
  logoSrc: '/images/game-backgrounds/NUPFPLogo.webp',
  /** Landscape intro for tablet/desktop (NUIntroScreen.png source). */
  backgroundSrc: '/images/game-backgrounds/NUIntroScreen.webp',
  /** Portrait intro for phones (NUIntroPhone.png source). */
  phoneBackgroundSrc: '/images/game-backgrounds/NUIntroPhone.webp',
  backgroundRevision: 3,
  /** Art includes logo + title — UI overlays only welcome/status at bottom. */
  artIncludesBranding: true,
} as const;

export type BootSessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface BootCopy {
  welcome: string | null;
  alias: string | null;
  status: string;
  enterLabel: string | null;
}

export function getBootCopy(
  status: BootSessionStatus,
  alias?: string | null,
): BootCopy {
  if (status === 'loading') {
    return {
      welcome: null,
      alias: null,
      status: 'CONNECTING TO THE NETWORK…',
      enterLabel: null,
    };
  }

  if (status === 'authenticated') {
    const name = alias?.trim();
    return {
      welcome: name ? `Welcome ${name}!` : 'Welcome back!',
      alias: null,
      status: 'NETWORK READY',
      enterLabel: 'ENTER EMPIRE',
    };
  }

  return {
    welcome: null,
    alias: null,
    status: 'NETWORK READY',
    enterLabel: 'SIGN IN',
  };
}

export function bootBackgroundUrl(): string {
  return `${BOOT_SCREEN.backgroundSrc}?v=${BOOT_SCREEN.backgroundRevision}`;
}

export function bootPhoneBackgroundUrl(): string {
  return `${BOOT_SCREEN.phoneBackgroundSrc}?v=${BOOT_SCREEN.backgroundRevision}`;
}

export function bootPhoneMediaQuery(): string {
  return `(max-width: ${BOOT_PHONE_MAX_WIDTH}px)`;
}
