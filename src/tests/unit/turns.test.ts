import { describe, it, expect } from 'vitest';
import {
  calculateRegeneratedTurns,
  settleTurnRegeneration,
  consumeTurns,
  createInitialTurnState,
  turnsPerDay,
  resolveCanonicalTurnState,
} from '@/lib/game-engine/turns';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';
import { TURNS_CONFIG } from '@/config/game/balance';
import { REDLITE_TURNS } from '@/config/game/redlite-rules';

describe('turn regeneration', () => {
  it('uses canonical Redlite turn rules from config', () => {
    expect(TURNS_CONFIG.turnCap).toBe(5000);
    expect(TURNS_CONFIG.startingTurns).toBe(5000);
    expect(REDLITE_TURNS.turnsPerInterval).toBe(2);
    expect(REDLITE_TURNS.intervalMinutes).toBe(5);
    expect(TURNS_CONFIG.regenerationRatePerMs).toBe(REDLITE_TURNS.regenerationRatePerMs);
  });

  it('generates approximately 576 turns per day (2 per 5 min)', () => {
    const perDay = turnsPerDay(TURNS_CONFIG.regenerationRatePerMs);
    expect(perDay).toBeCloseTo(576, 0);
  });

  it('regenerates turns based on elapsed time', () => {
    const last = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-01T01:00:00Z');
    const regen = calculateRegeneratedTurns(last, TURNS_CONFIG.regenerationRatePerMs, now);
    expect(regen).toBe(24);
  });

  it('never exceeds turn cap', () => {
    const state = {
      currentTurns: 4900,
      lastRegeneratedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      turnCap: TURNS_CONFIG.turnCap,
      regenerationRatePerMs: TURNS_CONFIG.regenerationRatePerMs,
    };
    const settled = settleTurnRegeneration(state);
    expect(settled.currentTurns).toBeLessThanOrEqual(TURNS_CONFIG.turnCap);
  });

  it('consumes turns and updates anchor', () => {
    const initial = createInitialTurnState();
    const settled = settleTurnRegeneration(initial);
    const { newState, consumed } = consumeTurns(settled, 10);
    expect(consumed).toBe(10);
    expect(newState.currentTurns).toBe(settled.currentTurns - 10);
  });

  it('rejects insufficient turns', () => {
    const settled = settleTurnRegeneration({
      currentTurns: 10,
      lastRegeneratedAt: new Date(),
      turnCap: 5000,
      regenerationRatePerMs: TURNS_CONFIG.regenerationRatePerMs,
    });
    expect(() => consumeTurns(settled, 50)).toThrow(GameplayError);
  });

  it('legacy 12000-cap accounts settle with canonical 5000 cap', () => {
    const legacy = {
      currentTurns: 8000,
      lastRegeneratedAt: new Date(Date.now() - 60 * 60 * 1000),
      turnCap: 12000,
      regenerationRatePerMs: 0.013888888888888888,
    };
    const canonical = resolveCanonicalTurnState(legacy);
    expect(canonical.turnCap).toBe(5000);
    expect(canonical.currentTurns).toBe(5000);
    expect(canonical.regenerationRatePerMs).toBe(TURNS_CONFIG.regenerationRatePerMs);

    const settled = settleTurnRegeneration(legacy);
    expect(settled.turnCap).toBe(5000);
    expect(settled.currentTurns).toBeLessThanOrEqual(5000);
  });

  it('new accounts use identical rules via createInitialTurnState', () => {
    const initial = createInitialTurnState();
    expect(initial.turnCap).toBe(5000);
    expect(initial.currentTurns).toBe(5000);
    expect(initial.regenerationRatePerMs).toBe(TURNS_CONFIG.regenerationRatePerMs);
  });

  it('handles long offline periods', () => {
    const state = {
      currentTurns: 0,
      lastRegeneratedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      turnCap: TURNS_CONFIG.turnCap,
      regenerationRatePerMs: TURNS_CONFIG.regenerationRatePerMs,
    };
    const settled = settleTurnRegeneration(state);
    expect(settled.currentTurns).toBe(TURNS_CONFIG.turnCap);
    expect(settled.isAtCap).toBe(true);
  });
});
