import { describe, expect, it } from 'vitest';
import {
  clampAccentHex,
  colorsAreDistinct,
  normalizeHexColor,
  buildThemePalette,
} from '@/lib/game-engine/theme-safety';

describe('theme-safety', () => {
  it('normalizes valid hex', () => {
    expect(normalizeHexColor('#AABBCC')).toBe('#aabbcc');
  });

  it('rejects invalid hex', () => {
    expect(normalizeHexColor('red')).toBeNull();
  });

  it('clamps near-black primary to readable accent', () => {
    const out = clampAccentHex('#050505', 'primary');
    expect(out).not.toBe('#050505');
  });

  it('builds palette with glow and muted variants', () => {
    const palette = buildThemePalette('#ff1493', '#6a0dad');
    expect(palette.glow).toContain('rgba');
    expect(colorsAreDistinct(palette.primary, palette.secondary)).toBe(true);
  });
});
