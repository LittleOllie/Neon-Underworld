import { describe, expect, it } from 'vitest';
import {
  NAVIGATION_LOADER_LOGO,
  NAVIGATION_TRANSITION_THRESHOLDS,
  navigationRouteMessage,
  routeSuspenseLoadingMessage,
} from '@local/config/navigation-transition';

describe('navigation-transition config', () => {
  it('defines logo in one place', () => {
    expect(NAVIGATION_LOADER_LOGO).toBe('/images/game-backgrounds/NUPFPLogo.webp');
  });

  it('uses three-stage timing thresholds', () => {
    expect(NAVIGATION_TRANSITION_THRESHOLDS.subtleMs).toBe(175);
    expect(NAVIGATION_TRANSITION_THRESHOLDS.fullMs).toBe(700);
    expect(NAVIGATION_TRANSITION_THRESHOLDS.timeoutMs).toBe(10_000);
  });

  it('maps major game routes to network messages', () => {
    expect(navigationRouteMessage('/scout')).toBe('SCANNING THE STREETS...');
    expect(navigationRouteMessage('/produce')).toBe('OPENING THE LAB...');
    expect(navigationRouteMessage('/shop')).toBe('CONTACTING SUPPLIERS...');
    expect(navigationRouteMessage('/market')).toBe('CONNECTING TO MARKET...');
    expect(navigationRouteMessage('/cartels')).toBe('OPENING CARTEL NETWORK...');
    expect(navigationRouteMessage('/attack')).toBe('LOCATING TARGETS...');
    expect(navigationRouteMessage('/businesses')).toBe('LOADING OPERATIONS...');
    expect(navigationRouteMessage('/reports')).toBe('DECRYPTING REPORTS...');
    expect(navigationRouteMessage('/rankings')).toBe('CHECKING THE NETWORK...');
    expect(navigationRouteMessage('/settings')).toBe('ACCESSING SETTINGS...');
  });

  it('uses contextual messages for nested routes', () => {
    expect(navigationRouteMessage('/reports/abc123')).toBe('DECRYPTING REPORT...');
    expect(navigationRouteMessage('/players/neonviper')).toBe('LOCATING PLAYER...');
  });

  it('falls back to network connect copy', () => {
    expect(navigationRouteMessage('/unknown-route')).toBe('CONNECTING TO NETWORK...');
  });

  it('provides softer suspense copy for route skeleton strip', () => {
    expect(routeSuspenseLoadingMessage('/market')).toBe('Connecting to market…');
  });
});
