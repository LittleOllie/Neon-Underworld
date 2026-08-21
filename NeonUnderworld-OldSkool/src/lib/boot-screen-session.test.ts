import { describe, expect, it } from 'vitest';
import {
  bootMayRouteToLogin,
  isBootEnterReady,
  isProtectedGameRoute,
  resolveBootDismissTarget,
  resolveBootDismissTargetForClick,
  resolveBootSessionStatus,
  shouldSkipBootScreen,
} from '@local/lib/boot-screen-session';

describe('boot screen session safety', () => {
  it('loading on protected game routes assumes authenticated — middleware already passed', () => {
    expect(resolveBootSessionStatus('loading', '/command')).toBe('authenticated');
    expect(resolveBootSessionStatus('loading', '/shop')).toBe('authenticated');
    expect(resolveBootDismissTarget('/command', 'authenticated')).toBe('/command');
    expect(bootMayRouteToLogin('loading')).toBe(false);
  });

  it('loading on public entry routes stays loading', () => {
    expect(resolveBootSessionStatus('loading', '/')).toBe('loading');
    expect(resolveBootDismissTarget('/command', 'loading')).toBeNull();
    expect(resolveBootDismissTarget('/login', 'loading')).toBeNull();
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

  it('unauthenticated client on protected game routes still shows Enter — middleware passed', () => {
    expect(resolveBootSessionStatus('unauthenticated', '/command')).toBe('authenticated');
    expect(resolveBootSessionStatus('unauthenticated', '/attack')).toBe('authenticated');
    expect(resolveBootDismissTarget('/command', 'authenticated')).toBe('/command');
    expect(bootMayRouteToLogin('authenticated')).toBe(false);
  });

  it('recognises protected game routes', () => {
    expect(isProtectedGameRoute('/command')).toBe(true);
    expect(isProtectedGameRoute('/attack')).toBe(true);
    expect(isProtectedGameRoute('/reports/abc')).toBe(true);
    expect(isProtectedGameRoute('/login')).toBe(false);
    expect(isProtectedGameRoute('/')).toBe(false);
  });

  it('click dismiss on protected route while loading falls back to current path', () => {
    expect(resolveBootDismissTargetForClick('/market', 'loading')).toBe('/market');
    expect(resolveBootDismissTargetForClick('/command', 'loading')).toBe('/command');
  });

  it('skips boot screen on admin and auth routes', () => {
    expect(shouldSkipBootScreen('/admin')).toBe(true);
    expect(shouldSkipBootScreen('/admin/players')).toBe(true);
    expect(shouldSkipBootScreen('/login')).toBe(true);
    expect(shouldSkipBootScreen('/command')).toBe(false);
  });

  it('enter stays disabled until client session resolves', () => {
    expect(isBootEnterReady('loading', 'authenticated')).toBe(false);
    expect(isBootEnterReady('loading', 'loading')).toBe(false);
    expect(isBootEnterReady('authenticated', 'authenticated')).toBe(true);
    expect(isBootEnterReady('unauthenticated', 'unauthenticated')).toBe(true);
  });
});
