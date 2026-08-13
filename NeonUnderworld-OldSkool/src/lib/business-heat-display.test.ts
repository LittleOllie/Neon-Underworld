import { describe, it, expect } from 'vitest';
import { semanticLevelFromHeatScore } from './business-heat-display';

describe('semanticLevelFromHeatScore', () => {
  it('maps low heat to good (green)', () => {
    expect(semanticLevelFromHeatScore(0)).toBe('good');
    expect(semanticLevelFromHeatScore(24)).toBe('good');
  });

  it('maps moderate heat to warn (amber)', () => {
    expect(semanticLevelFromHeatScore(25)).toBe('warn');
    expect(semanticLevelFromHeatScore(49)).toBe('warn');
  });

  it('maps high and critical heat to danger (red)', () => {
    expect(semanticLevelFromHeatScore(50)).toBe('danger');
    expect(semanticLevelFromHeatScore(100)).toBe('danger');
  });
});
