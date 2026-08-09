export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class InsufficientTurnsError extends DomainError {
  constructor(available: number, requested: number) {
    super(`Insufficient turns: have ${available}, need ${requested}`, 'INSUFFICIENT_TURNS');
  }
}

export class InvalidScoutAmountError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_SCOUT_AMOUNT');
  }
}

export class AccountRestrictedError extends DomainError {
  constructor(message = 'This account is restricted') {
    super(message, 'ACCOUNT_RESTRICTED');
  }
}

export class SeasonInactiveError extends DomainError {
  constructor(message = 'No active season') {
    super(message, 'SEASON_INACTIVE');
  }
}

export class DuplicateActionError extends DomainError {
  constructor(message = 'This action has already been processed') {
    super(message, 'DUPLICATE_ACTION');
  }
}

export class ConfigurationError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED');
  }
}

export class InvalidInviteCodeError extends DomainError {
  constructor(message = 'Invalid or expired invite code') {
    super(message, 'INVALID_INVITE');
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  return 'An unexpected error occurred. Please try again.';
}
