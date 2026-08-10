import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isPlaytestTurnsEnabled } from '@/config/game/playtest';

describe('playtest turns safety', () => {
  const original = process.env.PLAYTEST_TURNS;

  afterEach(() => {
    if (original === undefined) delete process.env.PLAYTEST_TURNS;
    else process.env.PLAYTEST_TURNS = original;
  });

  it('is disabled by default when env unset', () => {
    delete process.env.PLAYTEST_TURNS;
    expect(isPlaytestTurnsEnabled()).toBe(false);
  });

  it('is disabled when env is false', () => {
    process.env.PLAYTEST_TURNS = 'false';
    expect(isPlaytestTurnsEnabled()).toBe(false);
  });

  it('is enabled only when explicitly true', () => {
    process.env.PLAYTEST_TURNS = 'true';
    expect(isPlaytestTurnsEnabled()).toBe(true);
  });
});
