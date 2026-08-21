/** Client-side accent extraction from uploaded PFP images (canvas). */

import { NU_DEFAULT_THEME } from '@/config/game/nu-default-theme';
import { clampAccentHex, colorsAreDistinct } from '@/lib/game-engine/theme-safety';

export type ExtractedAccents = {
  primary: string;
  secondary: string;
  source: 'extracted' | 'monochrome' | 'fallback';
};

type Rgb = { r: number; g: number; b: number };

const SAMPLE_SIZE = 32;
const MIN_ALPHA = 128;
const MIN_BUCKET_COUNT = 3;

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

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[c(r), c(g), c(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function isUsablePixel(r: number, g: number, b: number, a: number): boolean {
  if (a < MIN_ALPHA) return false;
  const { l, s } = rgbToHsl(r, g, b);
  if (l < 0.08 || l > 0.92) return false;
  if (s < 0.08 && (l < 0.15 || l > 0.85)) return false;
  return true;
}

function bucketKey(r: number, g: number, b: number): string {
  const br = Math.floor(r / 32);
  const bg = Math.floor(g / 32);
  const bb = Math.floor(b / 32);
  return `${br},${bg},${bb}`;
}

function scoreBucket(rgb: Rgb, count: number): number {
  const { s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const saturationWeight = 0.55 + s * 0.75;
  const brightnessWeight = 1 - Math.abs(l - 0.48) * 1.4;
  return count * saturationWeight * Math.max(0.35, brightnessWeight);
}

function pickSecondary(
  ranked: Array<{ rgb: Rgb; hex: string; score: number }>,
  primaryHex: string,
): string | null {
  for (const entry of ranked.slice(1, 12)) {
    if (colorsAreDistinct(primaryHex, entry.hex, 64)) {
      return entry.hex;
    }
  }
  return null;
}

/** Extract accent pair from image data sampled on a small canvas. */
export function extractAccentColorsFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ExtractedAccents {
  const buckets = new Map<string, { rgb: Rgb; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (!isUsablePixel(r, g, b, a)) continue;
    const key = bucketKey(r, g, b);
    const existing = buckets.get(key);
    if (existing) {
      existing.rgb.r += r;
      existing.rgb.g += g;
      existing.rgb.b += b;
      existing.count += 1;
    } else {
      buckets.set(key, { rgb: { r, g, b }, count: 1 });
    }
  }

  const ranked = [...buckets.values()]
    .filter((b) => b.count >= MIN_BUCKET_COUNT)
    .map((b) => {
      const rgb: Rgb = {
        r: b.rgb.r / b.count,
        g: b.rgb.g / b.count,
        b: b.rgb.b / b.count,
      };
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      return { rgb, hex, score: scoreBucket(rgb, b.count) };
    })
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return {
      primary: NU_DEFAULT_THEME.primary,
      secondary: NU_DEFAULT_THEME.secondary,
      source: 'fallback',
    };
  }

  const primary = clampAccentHex(ranked[0]!.hex, 'primary');
  const secondaryCandidate = pickSecondary(ranked, primary);
  const source: ExtractedAccents['source'] =
    ranked.length === 1 || !secondaryCandidate ? 'monochrome' : 'extracted';

  const secondary = clampAccentHex(
    secondaryCandidate ?? NU_DEFAULT_THEME.secondary,
    'secondary',
  );

  return { primary, secondary, source };
}

/** Load a File/Blob into canvas and extract accent colours. Never throws — returns fallback on failure. */
export async function extractAccentColorsFromImageFile(
  file: Blob,
): Promise<ExtractedAccents> {
  if (typeof document === 'undefined') {
    return {
      primary: NU_DEFAULT_THEME.primary,
      secondary: NU_DEFAULT_THEME.secondary,
      source: 'fallback',
    };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    bitmap.close?.();

    const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return extractAccentColorsFromImageData(imageData.data, SAMPLE_SIZE, SAMPLE_SIZE);
  } catch {
    return {
      primary: NU_DEFAULT_THEME.primary,
      secondary: NU_DEFAULT_THEME.secondary,
      source: 'fallback',
    };
  }
}

export { SAMPLE_SIZE };
