import { describe, it, expect } from 'vitest';
import { validateTurnAmount } from '@local/lib/numeric-input';
import { TURNS_CONFIG } from '@core/config/game/balance';
import { getScoutAreaDisplays } from '@core/lib/game-engine/scout-display';

describe('Scout turn input validation', () => {
  it('accepts valid scout amounts within balance and cap', () => {
    expect(validateTurnAmount(25, 431)).toBeNull();
    expect(validateTurnAmount(TURNS_CONFIG.maxScoutSpend, TURNS_CONFIG.maxScoutSpend)).toBeNull();
  });

  it('rejects zero and over-balance turns', () => {
    expect(validateTurnAmount(null, 100)).toBe('Enter at least 1 turn.');
    expect(validateTurnAmount(200, 100)).toBe('You only have 100 turns.');
  });
});

describe('Scout area selection', () => {
  it('loads selectable district areas including streets', () => {
    const areas = getScoutAreaDisplays('neon-strip');
    expect(areas.length).toBeGreaterThan(1);
    expect(areas.some((area) => area.slug === 'streets')).toBe(true);
  });
});

describe('Scout tier display helpers', () => {
  it('maps recruitment tiers to bar fill percentages', async () => {
    const { scoutRecruitmentTierPercent, scoutRiskTierPercent } = await import(
      '@core/lib/game-engine/scout-display'
    );
    expect(scoutRecruitmentTierPercent('High')).toBe(100);
    expect(scoutRecruitmentTierPercent('Medium')).toBe(55);
    expect(scoutRecruitmentTierPercent('Low')).toBe(28);
    expect(scoutRiskTierPercent('Low')).toBe(28);
    expect(scoutRiskTierPercent('High')).toBe(100);
  });
});
