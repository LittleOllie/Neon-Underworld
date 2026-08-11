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
  | 'ACCOUNT_RESTRICTED'
  | 'TRAVEL_ALREADY_THERE'
  | 'TRAVEL_IN_PROGRESS'
  | 'MARKET_ITEM_NOT_TRADABLE'
  | 'MARKET_INSUFFICIENT_QUANTITY'
  | 'MARKET_LISTING_ENDED'
  | 'MARKET_BID_TOO_LOW'
  | 'MARKET_CANNOT_BID_OWN_LISTING'
  | 'CARTEL_ALREADY_MEMBER'
  | 'CARTEL_FULL'
  | 'CARTEL_INVITE_INVALID'
  | 'CARTEL_NOT_LEADER'
  | 'ATTACK_CAP_REACHED'
  | 'OFFLINE_PROTECTION_ACTIVE';

export const GAMEPLAY_ERROR_MESSAGES: Record<GameplayErrorCode, string> = {
  INSUFFICIENT_CASH: "You don't have enough cash.",
  INSUFFICIENT_TURNS: "You don't have enough turns.",
  INSUFFICIENT_RIDES: "You don't have enough rides for this.",
  INVALID_QUANTITY: 'Enter a valid quantity.',
  INVALID_FORCE: 'Enter a valid number of thugs.',
  INVALID_TARGET: 'This player cannot be found.',
  INVALID_INTEL: 'This intel is no longer valid. Scout the player again.',
  EXPIRED_INTEL: 'This intel is no longer valid. Scout the player again.',
  TARGET_OUT_OF_RANGE: 'That player is below your attack range.',
  TARGET_WRONG_DISTRICT: 'You can only attack players in your district.',
  TARGET_UNAVAILABLE: 'This player cannot be attacked right now.',
  PLAYER_TRAVELLING: "You can't do that while travelling.",
  PLAYER_INCAPACITATED: "You can't do that right now.",
  SEASON_INACTIVE: 'No active season.',
  INVALID_SCOUT_AMOUNT: 'Enter a valid number of turns.',
  DUPLICATE_ACTION: 'This action has already been processed.',
  ACCOUNT_RESTRICTED: 'This account is restricted.',
  TRAVEL_ALREADY_THERE: 'You are already in this city.',
  TRAVEL_IN_PROGRESS: 'You are already travelling.',
  MARKET_ITEM_NOT_TRADABLE: 'This item cannot be listed on the Market.',
  MARKET_INSUFFICIENT_QUANTITY: "You don't own enough of this item.",
  MARKET_LISTING_ENDED: 'This auction has ended.',
  MARKET_BID_TOO_LOW: 'Your bid is too low.',
  MARKET_CANNOT_BID_OWN_LISTING: 'You cannot bid on your own listing.',
  CARTEL_ALREADY_MEMBER: 'You are already in a cartel.',
  CARTEL_FULL: 'This cartel is full.',
  CARTEL_INVITE_INVALID: 'This cartel invite is no longer valid.',
  CARTEL_NOT_LEADER: 'Only the cartel leader can do that.',
  ATTACK_CAP_REACHED: "You've reached your 24-hour attack limit against this player.",
  OFFLINE_PROTECTION_ACTIVE: 'This player is under offline protection after repeated attacks.',
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
  if (normalized.includes('outside your attack range') || normalized.includes('attack range') || normalized.includes('below your attack range')) {
    return new GameplayError('TARGET_OUT_OF_RANGE');
  }
  if (normalized.includes('turn state missing') || normalized.includes('turn state not found')) {
    return new GameplayError('TARGET_UNAVAILABLE', 'Your account is not ready for combat. Refresh and try again.');
  }
  if (normalized.includes('record to update not found')) {
    return new GameplayError('DUPLICATE_ACTION', 'This action is still processing. Refresh and try again.');
  }
  if (normalized.includes('serialization') || normalized.includes('deadlock')) {
    return new GameplayError('DUPLICATE_ACTION', 'This attack is still processing. Refresh and check Reports.');
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

  if (normalized.includes('already in this city') || normalized.includes('already there')) {
    return new GameplayError('TRAVEL_ALREADY_THERE');
  }
  if (normalized.includes('bid is too low') || normalized.includes('minimum bid')) {
    return new GameplayError('MARKET_BID_TOO_LOW');
  }
  if (normalized.includes('auction has ended') || normalized.includes('listing ended')) {
    return new GameplayError('MARKET_LISTING_ENDED');
  }
  if (normalized.includes('cartel is full')) {
    return new GameplayError('CARTEL_FULL');
  }
  if (normalized.includes('already in a cartel')) {
    return new GameplayError('CARTEL_ALREADY_MEMBER');
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
