import { describe, it, expect, vi } from 'vitest';
import {
  classifySignInFailure,
  confirmAuthenticatedSession,
  isExplicitSignInSuccess,
  loginFailureMessage,
  LOGIN_SESSION_CONFIRM_DELAY_MS,
  LOGIN_SESSION_CONFIRM_MAX_ATTEMPTS,
  resolvePostLoginPath,
} from './login-session';

describe('isExplicitSignInSuccess', () => {
  it('accepts ok:true with no error', () => {
    expect(isExplicitSignInSuccess({ ok: true, error: null, status: 200, url: '/command' })).toBe(true);
  });

  it('rejects undefined', () => {
    expect(isExplicitSignInSuccess(undefined)).toBe(false);
  });

  it('rejects null', () => {
    expect(isExplicitSignInSuccess(null)).toBe(false);
  });

  it('rejects ok:false without error', () => {
    expect(isExplicitSignInSuccess({ ok: false, status: 401, url: null })).toBe(false);
  });

  it('rejects ok:true with error', () => {
    expect(isExplicitSignInSuccess({ ok: true, error: 'CredentialsSignin' })).toBe(false);
  });

  it('rejects missing ok', () => {
    expect(isExplicitSignInSuccess({ error: null, status: 200 })).toBe(false);
  });
});

describe('classifySignInFailure', () => {
  it('returns null for explicit success', () => {
    expect(classifySignInFailure({ ok: true, error: null, status: 200 })).toBeNull();
  });

  it('maps undefined to network', () => {
    expect(classifySignInFailure(undefined)).toBe('network');
  });

  it('maps ok:false with error to invalid credentials', () => {
    expect(classifySignInFailure({ ok: false, error: 'CredentialsSignin', status: 401 })).toBe(
      'invalid_credentials',
    );
  });

  it('maps ok:false without error to network', () => {
    expect(classifySignInFailure({ ok: false, status: 500, url: null })).toBe('network');
  });

  it('maps error on ambiguous result to invalid credentials', () => {
    expect(classifySignInFailure({ ok: undefined, error: 'CredentialsSignin' })).toBe(
      'invalid_credentials',
    );
  });
});

describe('loginFailureMessage', () => {
  it('returns user-safe copy for each kind', () => {
    expect(loginFailureMessage('invalid_credentials')).toBe('Invalid email or password.');
    expect(loginFailureMessage('session_confirmation')).toContain('session');
    expect(loginFailureMessage('network')).toContain('Network error');
  });
});

describe('confirmAuthenticatedSession', () => {
  it('returns true on first authenticated read', async () => {
    const readSession = vi.fn().mockResolvedValue({ user: { email: 'a@b.c' } });
    await expect(confirmAuthenticatedSession(readSession)).resolves.toBe(true);
    expect(readSession).toHaveBeenCalledTimes(1);
  });

  it('retries until session appears', async () => {
    const readSession = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ user: undefined })
      .mockResolvedValueOnce({ user: { id: '1' } });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      confirmAuthenticatedSession(readSession, { sleep, maxAttempts: 5, delayMs: 10 }),
    ).resolves.toBe(true);
    expect(readSession).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('returns false when session never confirms', async () => {
    const readSession = vi.fn().mockResolvedValue(null);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      confirmAuthenticatedSession(readSession, {
        sleep,
        maxAttempts: 3,
        delayMs: 1,
      }),
    ).resolves.toBe(false);
    expect(readSession).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('uses bounded defaults', () => {
    expect(LOGIN_SESSION_CONFIRM_MAX_ATTEMPTS).toBe(8);
    expect(LOGIN_SESSION_CONFIRM_DELAY_MS).toBe(150);
  });
});

describe('resolvePostLoginPath', () => {
  it('routes admin entry to /admin', () => {
    expect(resolvePostLoginPath(true)).toBe('/admin');
  });

  it('routes standard login to /command', () => {
    expect(resolvePostLoginPath(false)).toBe('/command');
  });
});
