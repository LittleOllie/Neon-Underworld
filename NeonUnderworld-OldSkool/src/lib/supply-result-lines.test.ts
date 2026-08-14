import { describe, it, expect } from 'vitest';
import { buildSupplyImpactLines } from '@local/lib/supply-result-lines';

describe('buildSupplyImpactLines', () => {
  it('shows produced, supplies used, and net hash for hash production', () => {
    const lines = buildSupplyImpactLines({
      drugType: 'hash',
      drugUnitsProduced: 420,
      suppliesUsed: { hash: 335, condoms: 335, beer: 120 },
      hashNetChange: 85,
    });
    expect(lines[0]?.text).toContain('Produced: +420 hash');
    expect(lines.some((l) => l.text.includes('Supplies used'))).toBe(true);
    expect(lines.some((l) => l.text === 'Net Hash: +85')).toBe(true);
  });

  it('shows negative net hash without obsolete worker consumption copy', () => {
    const lines = buildSupplyImpactLines({
      drugType: 'hash',
      drugUnitsProduced: 200,
      suppliesUsed: { hash: 335 },
      hashNetChange: -135,
    });
    expect(lines.some((l) => l.text === 'Net Hash: -135')).toBe(true);
    expect(lines.some((l) => l.text.includes('Workers used more Hash'))).toBe(false);
    expect(lines.some((l) => l.text.includes('consumed more Hash'))).toBe(false);
  });

  it('omits net hash line for non-hash drugs', () => {
    const lines = buildSupplyImpactLines({
      drugType: 'coke',
      drugUnitsProduced: 564,
      suppliesUsed: { hash: 334, condoms: 334, beer: 334 },
    });
    expect(lines.some((l) => l.text.startsWith('Net Hash'))).toBe(false);
  });
});
