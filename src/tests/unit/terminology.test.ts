import { describe, it, expect } from 'vitest';
import { TERMS, NAV, term } from '@/config/game/terminology';

describe('terminology', () => {
  it('uses Cartel not Syndicate in navigation', () => {
    expect(NAV.cartel).toBe('Cartel');
    expect(TERMS.cartel).toBe('Cartel');
  });

  it('provides consistent resource labels', () => {
    expect(term('prostitutes')).toBe('Prostitutes');
    expect(term('thugs')).toBe('Thugs');
    expect(term('glocks')).toBe('Glocks');
  });

  it('has five navigation destinations', () => {
    expect(Object.keys(NAV)).toHaveLength(5);
  });
});
