import { describe, expect, it } from 'vitest';
import { extractAccentColorsFromImageData } from '@/lib/game-engine/extract-accent-colors';
import { NU_DEFAULT_THEME } from '@/config/game/nu-default-theme';
import { colorsAreDistinct } from '@/lib/game-engine/theme-safety';

describe('extractAccentColorsFromImageData', () => {
  it('returns fallback for empty pixels', () => {
    const data = new Uint8ClampedArray(32 * 32 * 4);
    const result = extractAccentColorsFromImageData(data, 32, 32);
    expect(result.source).toBe('fallback');
    expect(result.primary).toBe(NU_DEFAULT_THEME.primary);
  });

  it('extracts distinct accent pair from coloured blocks', () => {
    const data = new Uint8ClampedArray(32 * 32 * 4);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const i = (y * 32 + x) * 4;
        if (x < 16) {
          data[i] = 255;
          data[i + 1] = 20;
          data[i + 2] = 147;
        } else {
          data[i] = 0;
          data[i + 1] = 200;
          data[i + 2] = 255;
        }
        data[i + 3] = 255;
      }
    }
    const result = extractAccentColorsFromImageData(data, 32, 32);
    expect(result.source).toBe('extracted');
    expect(colorsAreDistinct(result.primary, result.secondary, 48)).toBe(true);
  });

  it('uses monochrome fallback when only one hue dominates', () => {
    const data = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 120;
      data[i + 1] = 120;
      data[i + 2] = 120;
      data[i + 3] = 255;
    }
    const result = extractAccentColorsFromImageData(data, 32, 32);
    expect(['monochrome', 'fallback']).toContain(result.source);
  });
});
