import { describe, it, expect, afterEach, vi } from 'vitest';
import { validateProductionEnv } from './env-validation';

describe('validateProductionEnv', () => {
  const originalPlaytest = process.env.PLAYTEST_TURNS;
  const originalPublicPlaytest = process.env.NEXT_PUBLIC_PLAYTEST_TURNS;
  const originalDb = process.env.DATABASE_URL;
  const originalAuth = process.env.AUTH_SECRET;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalPlaytest === undefined) delete process.env.PLAYTEST_TURNS;
    else process.env.PLAYTEST_TURNS = originalPlaytest;
    if (originalPublicPlaytest === undefined) delete process.env.NEXT_PUBLIC_PLAYTEST_TURNS;
    else process.env.NEXT_PUBLIC_PLAYTEST_TURNS = originalPublicPlaytest;
    if (originalDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDb;
    if (originalAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuth;
  });

  it('throws when PLAYTEST_TURNS is true in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.DATABASE_URL = 'postgresql://example';
    process.env.AUTH_SECRET = 'test-secret';
    process.env.PLAYTEST_TURNS = 'true';
    expect(() => validateProductionEnv()).toThrow(/PLAYTEST_TURNS must not be enabled/);
  });

  it('throws when NEXT_PUBLIC_PLAYTEST_TURNS is true in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.DATABASE_URL = 'postgresql://example';
    process.env.AUTH_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_PLAYTEST_TURNS = 'true';
    expect(() => validateProductionEnv()).toThrow(/PLAYTEST_TURNS must not be enabled/);
  });
});
