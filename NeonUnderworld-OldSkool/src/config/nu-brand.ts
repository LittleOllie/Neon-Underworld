/**
 * Neon Underworld brand assets — public/images/nu/brand/
 */

export const NU_LOGO_FILE = 'nu-logo.webp';
export const NU_LOGO_REVISION = 3;

export function nuLogoSrc(): string {
  return `/images/nu/brand/${NU_LOGO_FILE}`;
}

export function nuLogoUrl(): string {
  return `${nuLogoSrc()}?v=${NU_LOGO_REVISION}`;
}
