import { describe, it, expect } from 'vitest';
import { buildSupplyImpactLines } from '@local/lib/supply-result-lines';
import { OS_TERMS } from '@local/config/terminology';

describe('buildSupplyImpactLines', () => {
  it('shows produced, supplies used, and net components for hash production', () => {
    const lines = buildSupplyImpactLines({
      drugType: 'hash',
      drugUnitsProduced: 420,
      suppliesUsed: { hash: 335, condoms: 335, beer: 120 },
      hashNetChange: 85,
    });
    expect(lines[0]?.text).toContain(`Output: +420 ${OS_TERMS.hash}`);
    expect(lines.some((l) => l.text.includes('Supplies used'))).toBe(true);
    expect(lines.some((l) => l.text === `Net ${OS_TERMS.hash}: +85`)).toBe(true);
  });

  it('shows negative net components without obsolete worker consumption copy', () => {
    const lines = buildSupplyImpactLines({
      drugType: 'hash',
      drugUnitsProduced: 200,
      suppliesUsed: { hash: 335 },
      hashNetChange: -135,
    });
    expect(lines.some((l) => l.text === `Net ${OS_TERMS.hash}: -135`)).toBe(true);
    expect(lines.some((l) => l.text.includes('Workers used more Hash'))).toBe(false);
    expect(lines.some((l) => l.text.includes('consumed more Hash'))).toBe(false);
  });

  it('omits net components line for non-hash drugs', () => {
    const lines = buildSupplyImpactLines({
      drugType: 'coke',
      drugUnitsProduced: 564,
      suppliesUsed: { hash: 334, condoms: 334, beer: 334 },
    });
    expect(lines.some((l) => l.text.startsWith(`Net ${OS_TERMS.hash}`))).toBe(false);
  });
});
