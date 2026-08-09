import { describe, it, expect } from 'vitest';
import { validateTurnAmount } from '@local/lib/numeric-input';
import { TURNS_CONFIG } from '@core/config/game/balance';

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
