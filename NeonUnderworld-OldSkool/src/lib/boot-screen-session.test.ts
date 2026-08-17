import { describe, expect, it } from 'vitest';
import {
  bootMayRouteToLogin,
  resolveBootDismissTarget,
  resolveBootSessionStatus,
  shouldSkipBootOverlay,
} from '@local/lib/boot-screen-session';

describe('boot screen session safety', () => {
  it('loading status stays loading — never treated as logout', () => {
    expect(resolveBootSessionStatus('loading')).toBe('loading');
    expect(resolveBootDismissTarget('/command', 'loading')).toBeNull();
    expect(resolveBootDismissTarget('/login', 'loading')).toBeNull();
    expect(bootMayRouteToLogin('loading')).toBe(false);
  });

  it('authenticated status allows continue and preserves deep links', () => {
    expect(resolveBootSessionStatus('authenticated')).toBe('authenticated');
    expect(resolveBootDismissTarget('/attack', 'authenticated')).toBe('/attack');
    expect(resolveBootDismissTarget('/empire', 'authenticated')).toBe('/empire');
    expect(resolveBootDismissTarget('/login', 'authenticated')).toBe('/command');
    expect(resolveBootDismissTarget('/', 'authenticated')).toBe('/command');
    expect(bootMayRouteToLogin('authenticated')).toBe(false);
  });

  it('unauthenticated status may route to login only when explicitly unauthenticated', () => {
    expect(resolveBootSessionStatus('unauthenticated')).toBe('unauthenticated');
    expect(resolveBootDismissTarget('/command', 'unauthenticated')).toBe('/login');
    expect(bootMayRouteToLogin('unauthenticated')).toBe(true);
  });

  it('skips boot overlay on protected game deep links', () => {
    expect(shouldSkipBootOverlay('/command')).toBe(true);
    expect(shouldSkipBootOverlay('/attack')).toBe(true);
    expect(shouldSkipBootOverlay('/reports/abc')).toBe(true);
    expect(shouldSkipBootOverlay('/players/some-alias')).toBe(true);
  });

  it('shows boot overlay on entry/auth routes', () => {
    expect(shouldSkipBootOverlay('/')).toBe(false);
    expect(shouldSkipBootOverlay('/login')).toBe(false);
    expect(shouldSkipBootOverlay('/register')).toBe(false);
  });
});
