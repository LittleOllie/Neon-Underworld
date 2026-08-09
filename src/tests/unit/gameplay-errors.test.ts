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
      "You don't have enough rides for this attack.",
    );
    expect(GAMEPLAY_ERROR_MESSAGES.TARGET_OUT_OF_RANGE).toBe(
      'This player is now outside your attack range.',
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

  it('does not expose internal errors', () => {
    expect(toUserMessage(new Error('Turn state not found'))).toBe(
      'An unexpected error occurred. Please try again.',
    );
    expect(toUserMessage(new Error('PrismaClientKnownRequestError'))).toBe(
      'An unexpected error occurred. Please try again.',
    );
  });

  it('passes through GameplayError instances', () => {
    const err = new GameplayError('INVALID_INTEL');
    expect(toUserMessage(err)).toBe(GAMEPLAY_ERROR_MESSAGES.INVALID_INTEL);
  });
});
