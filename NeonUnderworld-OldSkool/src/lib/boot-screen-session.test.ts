import { describe, expect, it } from 'vitest';
import {
  bootMayRouteToLogin,
  isProtectedGameRoute,
  resolveBootDismissTarget,
  resolveBootSessionStatus,
  shouldSkipBootScreen,
} from '@local/lib/boot-screen-session';

describe('boot screen session safety', () => {
  it('loading status stays loading — never treated as logout', () => {
    expect(resolveBootSessionStatus('loading', '/command')).toBe('loading');
    expect(resolveBootDismissTarget('/command', 'loading')).toBeNull();
    expect(resolveBootDismissTarget('/login', 'loading')).toBeNull();
    expect(bootMayRouteToLogin('loading')).toBe(false);
  });

  it('authenticated status allows continue and preserves deep links', () => {
    expect(resolveBootSessionStatus('authenticated', '/attack')).toBe('authenticated');
    expect(resolveBootDismissTarget('/attack', 'authenticated')).toBe('/attack');
    expect(resolveBootDismissTarget('/empire', 'authenticated')).toBe('/empire');
    expect(resolveBootDismissTarget('/command', 'authenticated')).toBe('/command');
    expect(resolveBootDismissTarget('/login', 'authenticated')).toBe('/command');
    expect(resolveBootDismissTarget('/', 'authenticated')).toBe('/command');
    expect(bootMayRouteToLogin('authenticated')).toBe(false);
  });

  it('unauthenticated on entry routes may route to login', () => {
    expect(resolveBootSessionStatus('unauthenticated', '/login')).toBe('unauthenticated');
    expect(resolveBootDismissTarget('/login', 'unauthenticated')).toBe('/login');
    expect(bootMayRouteToLogin('unauthenticated')).toBe(true);
  });

  it('unauthenticated on protected game routes may sign in', () => {
    expect(resolveBootSessionStatus('unauthenticated', '/command')).toBe('unauthenticated');
    expect(resolveBootSessionStatus('unauthenticated', '/attack')).toBe('unauthenticated');
    expect(resolveBootDismissTarget('/command', 'unauthenticated')).toBe('/login');
    expect(bootMayRouteToLogin('unauthenticated')).toBe(true);
  });

  it('recognises protected game routes', () => {
    expect(isProtectedGameRoute('/command')).toBe(true);
    expect(isProtectedGameRoute('/attack')).toBe(true);
    expect(isProtectedGameRoute('/reports/abc')).toBe(true);
    expect(isProtectedGameRoute('/login')).toBe(false);
    expect(isProtectedGameRoute('/')).toBe(false);
  });

  it('skips boot screen on admin and auth routes', () => {
    expect(shouldSkipBootScreen('/admin')).toBe(true);
    expect(shouldSkipBootScreen('/admin/players')).toBe(true);
    expect(shouldSkipBootScreen('/login')).toBe(true);
    expect(shouldSkipBootScreen('/command')).toBe(false);
  });
});
