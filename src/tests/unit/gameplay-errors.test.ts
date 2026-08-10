import { describe, it, expect } from 'vitest';
import {
  GameplayError,
  GAMEPLAY_ERROR_MESSAGES,
  toUserMessage,
  tryGameplayErrorFromMessage,
} from '@/lib/game-engine/gameplay-errors';

describe('GameplayError', () => {
  it('exposes safe messages for expected failure codes', () => {
    expect(GAMEPLAY_ERROR_MESSAGES.INSUFFICIENT_CASH).toBe("You don't have enough cash.");
    expect(GAMEPLAY_ERROR_MESSAGES.INSUFFICIENT_TURNS).toBe("You don't have enough turns.");
    expect(GAMEPLAY_ERROR_MESSAGES.INSUFFICIENT_RIDES).toBe(
      "You don't have enough rides for this.",
    );
    expect(GAMEPLAY_ERROR_MESSAGES.TARGET_OUT_OF_RANGE).toBe(
      'That player is below your attack range.',
    );
  });

  it('maps shop insufficient cash to safe message', () => {
    const mapped = tryGameplayErrorFromMessage('Insufficient cash.');
    expect(mapped?.gameplayCode).toBe('INSUFFICIENT_CASH');
    expect(toUserMessage(mapped)).toBe("You don't have enough cash.");
  });

  it('maps insufficient rides to safe message', () => {
    const mapped = tryGameplayErrorFromMessage(
      'Insufficient rides. Need 10 rides for 50 thugs.',
    );
    expect(mapped?.gameplayCode).toBe('INSUFFICIENT_RIDES');
  });

  it('maps travelling restriction to safe message', () => {
    const mapped = tryGameplayErrorFromMessage('Purchases unavailable while travelling.');
    expect(mapped?.gameplayCode).toBe('PLAYER_TRAVELLING');
  });

  it('maps turn state failures to useful messages', () => {
    expect(toUserMessage(new Error('Turn state missing'))).toMatch(/not ready for combat/i);
  });

  it('does not expose raw internal errors', () => {
    expect(toUserMessage(new Error('PrismaClientKnownRequestError'))).toBe(
      'An unexpected error occurred. Please try again.',
    );
  });

  it('passes through GameplayError instances', () => {
    const err = new GameplayError('INVALID_INTEL');
    expect(toUserMessage(err)).toBe(GAMEPLAY_ERROR_MESSAGES.INVALID_INTEL);
  });
});
