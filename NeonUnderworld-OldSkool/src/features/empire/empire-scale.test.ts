import { describe, it, expect } from 'vitest';
import {
  EMPIRE_SCALE_BANDS,
  empireScaleDescriptor,
  empireTotalCrew,
} from './empire-scale';

describe('empire-scale', () => {
  it('sums workers and thugs for display-only total crew', () => {
    expect(empireTotalCrew(97, 87)).toBe(184);
    expect(empireTotalCrew(7_421, 5_426)).toBe(12_847);
  });

  it('returns scale descriptor for each band boundary', () => {
    expect(empireScaleDescriptor(99)).toBe('Small underground operation');
    expect(empireScaleDescriptor(100)).toBe('Growing crew');
    expect(empireScaleDescriptor(499)).toBe('Growing crew');
    expect(empireScaleDescriptor(500)).toBe('Established operation');
    expect(empireScaleDescriptor(1_999)).toBe('Established operation');
    expect(empireScaleDescriptor(2_000)).toBe('District force');
    expect(empireScaleDescriptor(4_999)).toBe('District force');
    expect(empireScaleDescriptor(5_000)).toBe('Major underground network');
    expect(empireScaleDescriptor(9_999)).toBe('Major underground network');
    expect(empireScaleDescriptor(10_000)).toBe('Underworld powerhouse');
    expect(empireScaleDescriptor(19_999)).toBe('Underworld powerhouse');
    expect(empireScaleDescriptor(20_000)).toBe('Dominant empire');
    expect(empireScaleDescriptor(50_000)).toBe('Dominant empire');
  });

  it('covers contiguous bands without gaps', () => {
    for (let i = 0; i < EMPIRE_SCALE_BANDS.length - 1; i += 1) {
      const current = EMPIRE_SCALE_BANDS[i];
      const next = EMPIRE_SCALE_BANDS[i + 1];
      expect(current.max + 1).toBe(next.min);
    }
  });
});
