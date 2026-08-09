import { describe, it, expect } from 'vitest';
import { collectAttentionItems, prioritizeAttentionItems } from './attention-items';
import { DESKTOP_NAV, MOBILE_NAV, MORE_ITEMS, navIsActive } from '@local/config/navigation';
import { bandFromPercent, statusTextFromBand, semanticLevelFromPercent, formatTurnsExact } from '@local/server/domain/status-presentation';
import { isPlayerInboxReport } from '@local/server/services/report.service';

const baseCtx = {
  id: 'p1',
  thugs: 10,
  prostitutes: 5,
  glocks: 5,
  uzis: 0,
  aks: 0,
  rides: 2,
  hash: 10,
  shrooms: 0,
  coke: 0,
  heroin: 0,
  businesses: 0,
  condoms: 2,
  beer: 2,
  prostitutePayoutPercent: 50,
  turns: 100,
  travelling: false,
  travelDestination: null,
} as Parameters<typeof collectAttentionItems>[0]['ctx'];

describe('collectAttentionItems', () => {
  it('shows specific unarmed thug message not generic readiness', () => {
    const items = collectAttentionItems({
      ctx: baseCtx,
      brief: { armedThugs: 5, unarmedThugs: 3, bankCash: 0, readinessWarningCount: 2 },
      unreadCount: 0,
    });
    expect(items.some((i) => i.value === '3' && i.label?.includes('thugs are unarmed'))).toBe(true);
    expect(items.some((i) => i.label?.includes('readiness note'))).toBe(false);
  });

  it('prioritizes to three visible items', () => {
    const items = collectAttentionItems({
      ctx: baseCtx,
      brief: { armedThugs: 5, unarmedThugs: 1, bankCash: 0, readinessWarningCount: 0 },
      unreadCount: 5,
    });
    const { visible, remaining } = prioritizeAttentionItems(items, 3);
    expect(visible.length).toBeLessThanOrEqual(3);
    expect(remaining).toBe(Math.max(0, items.length - 3));
  });
});

describe('navigation shell config', () => {
  it('uses direct action links without abstract categories', () => {
    expect(DESKTOP_NAV.some((n) => n.label === 'Home')).toBe(true);
    expect(DESKTOP_NAV.some((n) => n.label === 'Empire')).toBe(true);
    expect(DESKTOP_NAV.some((n) => n.label === 'Operations')).toBe(false);
    expect(DESKTOP_NAV.some((n) => n.label === 'Attack')).toBe(false);
    expect(DESKTOP_NAV.some((n) => n.label === 'Rankings')).toBe(true);
    expect(MOBILE_NAV.some((n) => n.label === 'Rankings')).toBe(true);
    expect(MOBILE_NAV.some((n) => n.label === 'Attack')).toBe(false);
    expect(MORE_ITEMS.some((n) => n.href === '/bank')).toBe(false);
    expect(MORE_ITEMS.some((n) => n.href === '/reports')).toBe(true);
  });

  it('marks active routes correctly', () => {
    expect(navIsActive('/command', '/command')).toBe(true);
    expect(navIsActive('/scout', '/command')).toBe(false);
    expect(navIsActive('/reports/abc', '/reports')).toBe(true);
  });
});

describe('status meter bands', () => {
  it('maps percentages to accessible status text', () => {
    const band = bandFromPercent(82);
    expect(statusTextFromBand(band)).toBe('Stable');
  });

  it('maps semantic bar levels', () => {
    expect(semanticLevelFromPercent(80)).toBe('good');
    expect(semanticLevelFromPercent(50)).toBe('warn');
    expect(semanticLevelFromPercent(20)).toBe('danger');
  });
  it('formats turns exactly without K abbreviation', () => {
    expect(formatTurnsExact(1393, 5000)).toBe('1,393 / 5,000');
    expect(formatTurnsExact(487, 5000)).toBe('487 / 5,000');
  });
});

describe('player inbox reports', () => {
  it('excludes district scout clutter', () => {
    expect(isPlayerInboxReport({ type: 'DISTRICT_SCOUT' }, 'SCOUT')).toBe(false);
    expect(isPlayerInboxReport({ type: 'PLAYER_INTEL' }, 'SCOUT')).toBe(true);
    expect(isPlayerInboxReport({ type: 'ATTACK' }, 'COMBAT')).toBe(true);
  });
});
