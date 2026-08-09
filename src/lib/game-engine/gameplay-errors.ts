import { DomainError } from './errors';

/** Player-safe gameplay failure codes — never expose internal details to the client. */
export type GameplayErrorCode =
  | 'INSUFFICIENT_CASH'
  | 'INSUFFICIENT_TURNS'
  | 'INSUFFICIENT_RIDES'
  | 'INVALID_QUANTITY'
  | 'INVALID_FORCE'
  | 'INVALID_TARGET'
  | 'INVALID_INTEL'
  | 'EXPIRED_INTEL'
  | 'TARGET_OUT_OF_RANGE'
  | 'TARGET_WRONG_DISTRICT'
  | 'TARGET_UNAVAILABLE'
  | 'PLAYER_TRAVELLING'
  | 'PLAYER_INCAPACITATED'
  | 'SEASON_INACTIVE'
  | 'INVALID_SCOUT_AMOUNT'
  | 'DUPLICATE_ACTION'
  | 'ACCOUNT_RESTRICTED';

export const GAMEPLAY_ERROR_MESSAGES: Record<GameplayErrorCode, string> = {
  INSUFFICIENT_CASH: "You don't have enough cash.",
  INSUFFICIENT_TURNS: "You don't have enough turns.",
  INSUFFICIENT_RIDES: "You don't have enough rides for this attack.",
  INVALID_QUANTITY: 'Enter a valid quantity.',
  INVALID_FORCE: 'Enter a valid number of thugs.',
  INVALID_TARGET: 'This player cannot be found.',
  INVALID_INTEL: 'This intel is no longer valid. Scout the player again.',
  EXPIRED_INTEL: 'This intel is no longer valid. Scout the player again.',
  TARGET_OUT_OF_RANGE: 'This player is now outside your attack range.',
  TARGET_WRONG_DISTRICT: 'You can only attack players in your district.',
  TARGET_UNAVAILABLE: 'This player cannot be attacked right now.',
  PLAYER_TRAVELLING: "You can't do that while travelling.",
  PLAYER_INCAPACITATED: "You can't do that right now.",
  SEASON_INACTIVE: 'No active season.',
  INVALID_SCOUT_AMOUNT: 'Enter a valid number of turns.',
  DUPLICATE_ACTION: 'This action has already been processed.',
  ACCOUNT_RESTRICTED: 'This account is restricted.',
};

export class GameplayError extends DomainError {
  constructor(
    public readonly gameplayCode: GameplayErrorCode,
    message?: string,
  ) {
    super(message ?? GAMEPLAY_ERROR_MESSAGES[gameplayCode], gameplayCode);
    this.name = 'GameplayError';
  }
}

export function throwGameplay(code: GameplayErrorCode, message?: string): never {
  throw new GameplayError(code, message);
}

/** Map legacy validation strings to typed gameplay errors (single normalization path). */
export function tryGameplayErrorFromMessage(message: string): GameplayError | null {
  const normalized = message.trim().toLowerCase();

  if (normalized.includes('insufficient cash')) {
    return new GameplayError('INSUFFICIENT_CASH');
  }
  if (normalized.includes('insufficient turns') || normalized.includes('insufficient turn')) {
    return new GameplayError('INSUFFICIENT_TURNS');
  }
  if (normalized.includes('insufficient rides') || (normalized.includes('need') && normalized.includes('ride'))) {
    return new GameplayError('INSUFFICIENT_RIDES');
  }
  if (
    normalized.includes('quantity must') ||
    normalized.includes('maximum 1,000') ||
    normalized.includes('positive whole number') ||
    normalized.includes('invalid purchase total')
  ) {
    return new GameplayError('INVALID_QUANTITY');
  }
  if (
    normalized.includes('invalid attacking force') ||
    normalized.includes('enough thugs for this force')
  ) {
    return new GameplayError('INVALID_FORCE');
  }
  if (
    normalized.includes('scout intelligence report not found') ||
    normalized.includes('invalid scout intelligence') ||
    normalized.includes('scout report does not match')
  ) {
    return new GameplayError('INVALID_INTEL');
  }
  if (
    normalized.includes('valid scout intelligence') ||
    normalized.includes('scout them first')
  ) {
    return new GameplayError('EXPIRED_INTEL');
  }
  if (normalized.includes('outside your attack range') || normalized.includes('attack range')) {
    return new GameplayError('TARGET_OUT_OF_RANGE');
  }
  if (
    normalized.includes('cannot attack yourself') ||
    normalized.includes('cannot scout yourself') ||
    normalized.includes('target player not found') ||
    normalized.includes('attack limit reached')
  ) {
    return new GameplayError('INVALID_TARGET');
  }
  if (
    normalized.includes('cannot be attacked') ||
    normalized.includes('travelling and cannot be attacked') ||
    normalized.includes('cannot attack in your current status')
  ) {
    return new GameplayError('TARGET_UNAVAILABLE');
  }
  if (normalized.includes('while travelling') || normalized.includes('unavailable while travelling')) {
    return new GameplayError('PLAYER_TRAVELLING');
  }
  if (
    normalized.includes('current status') ||
    normalized.includes('life status') ||
    normalized.includes('purchases unavailable in your current status')
  ) {
    return new GameplayError('PLAYER_INCAPACITATED');
  }
  if (normalized.includes('no active season')) {
    return new GameplayError('SEASON_INACTIVE');
  }
  if (normalized.includes('turn') && (normalized.includes('invalid') || normalized.includes('between') || normalized.includes('whole number') || normalized.includes('minimum') || normalized.includes('maximum'))) {
    return new GameplayError('INVALID_SCOUT_AMOUNT');
  }

  return null;
}

export function gameplayErrorFromMessage(message: string): GameplayError {
  return tryGameplayErrorFromMessage(message) ?? new GameplayError('INVALID_TARGET');
}

export function throwIfValidationMessage(message: string | null): void {
  if (message) {
    const mapped = tryGameplayErrorFromMessage(message);
    if (mapped) throw mapped;
    throw new GameplayError('INVALID_QUANTITY', message);
  }
}

/** Normalise any caught error to a player-safe message. */
export function toUserMessage(error: unknown): string {
  if (error instanceof GameplayError) return error.message;
  if (error instanceof DomainError) return error.message;
  if (error instanceof Error && error.message.trim()) {
    const mapped = tryGameplayErrorFromMessage(error.message);
    if (mapped) return mapped.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
