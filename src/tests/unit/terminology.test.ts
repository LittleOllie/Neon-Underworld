import { describe, it, expect } from 'vitest';
import { TERMS, NAV, term, resourceLabel } from '@/config/game/terminology';

describe('terminology', () => {
  it('uses Faction in navigation', () => {
    expect(NAV.cartel).toBe('Faction');
    expect(TERMS.cartel).toBe('Faction');
  });

  it('provides consistent resource labels', () => {
    expect(term('prostitutes')).toBe('Specialists');
    expect(term('thugs')).toBe('Enforcers');
    expect(term('glocks')).toBe('Sidearms');
    expect(resourceLabel('hash')).toBe('Components');
    expect(resourceLabel('heroin')).toBe('Cores');
  });

  it('maps influence over net worth for player-facing power', () => {
    expect(term('netWorth')).toBe('Influence');
  });

  it('has five navigation destinations', () => {
    expect(Object.keys(NAV)).toHaveLength(5);
  });
});
