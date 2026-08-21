import { NU_DEFAULT_THEME, type ThemePalette } from '@/config/game/nu-default-theme';

export type { ThemePalette };

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return `#${trimmed.slice(1).toLowerCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rn:
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      break;
    case gn:
      h = ((bn - rn) / d + 2) / 6;
      break;
    default:
      h = ((rn - gn) / d + 4) / 6;
      break;
  }
  return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  return {
    r: hue2rgb(p, q, hk + 1 / 3) * 255,
    g: hue2rgb(p, q, hk) * 255,
    b: hue2rgb(p, q, hk - 1 / 3) * 255,
  };
}

/** Clamp player-chosen accents into usable UI accent range. */
export function clampAccentHex(hex: string, role: 'primary' | 'secondary'): string {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return role === 'primary' ? NU_DEFAULT_THEME.primary : NU_DEFAULT_THEME.secondary;

  const { r, g, b } = hexToRgb(normalized);
  let { h, s, l } = rgbToHsl(r, g, b);

  s = Math.max(0.32, Math.min(1, s));
  if (role === 'primary') {
    l = Math.max(0.38, Math.min(0.62, l));
  } else {
    l = Math.max(0.22, Math.min(0.48, l));
  }

  const out = hslToRgb(h, s, l);
  return rgbToHex(out.r, out.g, out.b);
}

function rgbaFromHex(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildThemePalette(primaryRaw: string, secondaryRaw: string): ThemePalette {
  const primary = clampAccentHex(primaryRaw, 'primary');
  const secondary = clampAccentHex(secondaryRaw, 'secondary');
  return {
    primary,
    secondary,
    glow: rgbaFromHex(primary, 0.45),
    muted: rgbaFromHex(primary, 0.1),
    mutedStrong: rgbaFromHex(primary, 0.18),
  };
}

export function themePaletteToCssVars(palette: ThemePalette): Record<string, string> {
  return {
    '--nu-accent-primary': palette.primary,
    '--nu-accent-secondary': palette.secondary,
    '--nu-accent-glow': palette.glow,
    '--nu-accent-muted': palette.muted,
    '--nu-accent-muted-strong': palette.mutedStrong,
    '--nu-accent-primary-soft': rgbaFromHex(palette.primary, 0.14),
    '--nu-accent-secondary-soft': rgbaFromHex(palette.secondary, 0.2),
    '--os-gold': palette.primary,
    '--os-gold-dark': palette.secondary,
    '--os-highlight': palette.muted,
    '--os-highlight-strong': palette.mutedStrong,
    '--os-link': palette.primary,
    '--game-gold': palette.primary,
    '--game-gold-dark': palette.secondary,
  };
}

export function colorDistance(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function colorsAreDistinct(hexA: string, hexB: string, minDistance = 72): boolean {
  return colorDistance(hexA, hexB) >= minDistance;
}
