import { describe, it, expect } from 'vitest';
import { validateScoutAmount } from '@/lib/game-engine/scouting';
import { validateProductionAmount } from '@/lib/game-engine/production';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';

describe('Scout and produce validation failures', () => {
  it('scout insufficient turns maps to safe message', () => {
    const result = validateScoutAmount(100, 50);
    expect(result.valid).toBe(false);
    const err = new GameplayError('INSUFFICIENT_TURNS');
    expect(toUserMessage(err)).toBe("You don't have enough turns.");
  });

  it('produce insufficient turns maps to safe message', () => {
    const result = validateProductionAmount(100, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Insufficient turns');
    expect(toUserMessage(new GameplayError('INSUFFICIENT_TURNS'))).toBe(
      "You don't have enough turns.",
    );
  });

  it('invalid scout amount returns validation error', () => {
    const result = validateScoutAmount(0, 100);
    expect(result.valid).toBe(false);
  });
});
