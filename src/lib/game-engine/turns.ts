import { TURNS_CONFIG } from '@/config/game/balance';

export interface TurnState {
  currentTurns: number;
  lastRegeneratedAt: Date;
  turnCap: number;
  regenerationRatePerMs: number;
}

export interface SettledTurnState extends TurnState {
  regeneratedTurns: number;
  isAtCap: boolean;
  msUntilNextTurn: number;
}

const MS_PER_HOUR = 60 * 60 * 1000;

export function calculateRegeneratedTurns(
  lastRegeneratedAt: Date,
  regenerationRatePerMs: number,
  now: Date = new Date(),
): number {
  const elapsed = Math.max(0, now.getTime() - lastRegeneratedAt.getTime());
  return Math.floor(elapsed * regenerationRatePerMs);
}

/** Apply canonical OldSkool turn cap and regeneration rate (2 / 6 min, cap 5000). */
export function resolveCanonicalTurnState(state: TurnState): TurnState {
  return {
    currentTurns: Math.min(state.currentTurns, TURNS_CONFIG.turnCap),
    lastRegeneratedAt: state.lastRegeneratedAt,
    turnCap: TURNS_CONFIG.turnCap,
    regenerationRatePerMs: TURNS_CONFIG.regenerationRatePerMs,
  };
}

export function settleTurnRegeneration(
  state: TurnState,
  now: Date = new Date(),
): SettledTurnState {
  const canonical = resolveCanonicalTurnState(state);
  const regenerated = calculateRegeneratedTurns(
    canonical.lastRegeneratedAt,
    canonical.regenerationRatePerMs,
    now,
  );
  const total = Math.min(canonical.currentTurns + regenerated, canonical.turnCap);
  const isAtCap = total >= canonical.turnCap;

  let msUntilNextTurn = 0;
  if (!isAtCap) {
    const rate = canonical.regenerationRatePerMs;
    if (rate > 0) {
      msUntilNextTurn = Math.ceil(1 / rate);
    }
  }

  return {
    ...canonical,
    currentTurns: total,
    regeneratedTurns: regenerated,
    isAtCap,
    msUntilNextTurn,
  };
}

export function consumeTurns(
  settled: SettledTurnState,
  amount: number,
  now: Date = new Date(),
): { newState: TurnState; consumed: number } {
  if (amount <= 0) {
    throw new Error('Turn amount must be positive');
  }
  if (amount > settled.currentTurns) {
    throw new Error('Insufficient turns');
  }

  const remaining = settled.currentTurns - amount;
  const regenerated = settled.regeneratedTurns;

  let newLastRegeneratedAt = settled.lastRegeneratedAt;
  if (regenerated > 0) {
    const msConsumed = regenerated / settled.regenerationRatePerMs;
    newLastRegeneratedAt = new Date(settled.lastRegeneratedAt.getTime() + msConsumed);
  }

  if (remaining === 0 && settled.regenerationRatePerMs > 0) {
    newLastRegeneratedAt = now;
  }

  return {
    consumed: amount,
    newState: {
      currentTurns: remaining,
      lastRegeneratedAt: newLastRegeneratedAt,
      turnCap: settled.turnCap,
      regenerationRatePerMs: settled.regenerationRatePerMs,
    },
  };
}

export function formatTimeUntilNextTurn(ms: number): string {
  if (ms <= 0) return 'Now';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function createInitialTurnState(): TurnState {
  return {
    currentTurns: TURNS_CONFIG.startingTurns,
    lastRegeneratedAt: new Date(),
    turnCap: TURNS_CONFIG.turnCap,
    regenerationRatePerMs: TURNS_CONFIG.regenerationRatePerMs,
  };
}

export function turnsPerDay(regenerationRatePerMs: number): number {
  return regenerationRatePerMs * 24 * MS_PER_HOUR;
}
