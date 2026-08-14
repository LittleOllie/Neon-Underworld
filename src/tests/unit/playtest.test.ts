import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isPlaytestTurnsEnabled, isPlaytestTurnsNavVisible } from '@/config/game/playtest';

describe('playtest turns safety', () => {
  const originalServer = process.env.PLAYTEST_TURNS;
  const originalPublic = process.env.NEXT_PUBLIC_PLAYTEST_TURNS;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalServer === undefined) delete process.env.PLAYTEST_TURNS;
    else process.env.PLAYTEST_TURNS = originalServer;
    if (originalPublic === undefined) delete process.env.NEXT_PUBLIC_PLAYTEST_TURNS;
    else process.env.NEXT_PUBLIC_PLAYTEST_TURNS = originalPublic;
  });

  it('is disabled when env unset (production-safe default)', () => {
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

  it('hides nav when public env unset', () => {
    delete process.env.NEXT_PUBLIC_PLAYTEST_TURNS;
    expect(isPlaytestTurnsNavVisible()).toBe(false);
  });

  it('shows nav only when public env is true', () => {
    process.env.NEXT_PUBLIC_PLAYTEST_TURNS = 'true';
    expect(isPlaytestTurnsNavVisible()).toBe(true);
  });

  it('hides nav when public env is false', () => {
    process.env.NEXT_PUBLIC_PLAYTEST_TURNS = 'false';
    expect(isPlaytestTurnsNavVisible()).toBe(false);
  });

  it('hard-disables server grants in production even when env is true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.PLAYTEST_TURNS = 'true';
    expect(isPlaytestTurnsEnabled()).toBe(false);
  });

  it('hard-disables nav in production even when public env is true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.NEXT_PUBLIC_PLAYTEST_TURNS = 'true';
    expect(isPlaytestTurnsNavVisible()).toBe(false);
  });
});
