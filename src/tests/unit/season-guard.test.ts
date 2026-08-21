import { describe, it, expect, afterEach } from 'vitest';
import {
  assertGameplaySeasonActive,
  isSeasonEnforcementEnabled,
} from '@/lib/game-engine/season-guard';
import { SeasonInactiveError } from '@/lib/game-engine/errors';

describe('season-guard', () => {
  const original = process.env.NU_ENFORCE_ACTIVE_SEASON;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NU_ENFORCE_ACTIVE_SEASON;
    } else {
      process.env.NU_ENFORCE_ACTIVE_SEASON = original;
    }
  });

  it('defaults to trial mode (enforcement off)', () => {
    delete process.env.NU_ENFORCE_ACTIVE_SEASON;
    expect(isSeasonEnforcementEnabled()).toBe(false);
    expect(() => assertGameplaySeasonActive({ status: 'ENDED' })).not.toThrow();
  });

  it('blocks ended seasons when enforcement is on', () => {
    process.env.NU_ENFORCE_ACTIVE_SEASON = 'true';
    expect(isSeasonEnforcementEnabled()).toBe(true);
    expect(() => assertGameplaySeasonActive({ status: 'ENDED' })).toThrow(SeasonInactiveError);
    expect(() => assertGameplaySeasonActive({ status: 'ACTIVE' })).not.toThrow();
  });
});
