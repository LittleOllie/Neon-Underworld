/** Boot / intro screen assets and copy helpers. */

import { nuBackgroundUrl } from '@local/config/nu-backgrounds';
import { nuLogoUrl } from '@local/config/nu-brand';

/** Viewport width at or below which portrait phone intro art is used. */
export const BOOT_PHONE_MAX_WIDTH = 768;

export const BOOT_SCREEN = {
  logoSrc: nuLogoUrl(),
  /** Approved Phase 3 intro — public/images/nu/backgrounds/intro.webp */
  backgroundSrc: nuBackgroundUrl('intro'),
  backgroundRevision: 1,
  /** Environment art only — logo is a separate HTML overlay. */
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
  return BOOT_SCREEN.backgroundSrc;
}
