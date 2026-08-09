import { describe, it, expect } from 'vitest';
import { getRecommendation, getCommandPresentation } from '@/features/command/recommendations';
import type { PlayerState } from '@/server/queries/player.queries';

function mockState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    alias: 'Test',
    district: { id: 'd1', slug: 'neon-strip', name: 'Neon Strip', description: '', modifiers: {}, active: true },
    season: { id: 's1', number: 1, name: 'S1', status: 'ACTIVE', startsAt: new Date(), endsAt: new Date(), createdAt: new Date() },
    daysRemaining: 30,
    cash: 1000,
    prostitutes: 5,
    thugs: 2,
    rides: 0,
    glocks: 1,
    uzis: 0,
    aks: 0,
    beer: 5,
    condoms: 10,
    hash: 5,
    shrooms: 0,
    coke: 0,
    heroin: 0,
    prostitutePayoutPercent: 50,
    turns: 500,
    turnCap: 5000,
    isAtCap: false,
    msUntilNextTurn: 60000,
    timeUntilNextTurn: '1m',
    netWorth: 10000,
    rank: 5,
    prostituteHappiness: { score: 70, hashReadiness: 1, condomReadiness: 1, protectionReadiness: 1, weaponReadiness: 0, beerReadiness: 0, warnings: [] },
    thugHappiness: { score: 70, hashReadiness: 0, condomReadiness: 0, protectionReadiness: 0, weaponReadiness: 1, beerReadiness: 1, warnings: [] },
    seasonDisplay: {
      number: 1,
      totalDays: 30,
      currentDay: 1,
      daysRemaining: 29,
      label: 'Season 1',
      dayLabel: 'Day 1 of 30',
      remainingLabel: '29 days remaining',
    },
    rankMovement: 0,
    netWorthMovement: 0,
    lastLoginAt: null,
    ...overrides,
  } as PlayerState;
}

describe('recommendations', () => {
  it('recommends scouting when turns available', () => {
    const rec = getRecommendation(mockState({ turns: 200 }));
    expect(rec.href).toBe('/operations/scout');
    expect(rec.action).toBe('Begin Operation');
  });

  it('routes to empire when happiness is low', () => {
    const rec = getRecommendation(mockState({
      turns: 10,
      prostituteHappiness: { score: 30, hashReadiness: 0.2, condomReadiness: 0.2, protectionReadiness: 0.2, weaponReadiness: 0, beerReadiness: 0, warnings: ['Low'] },
    }));
    expect(rec.href).toBe('/empire');
  });

  it('presents READY status with district headline when turns available', () => {
    const presentation = getCommandPresentation(mockState({ turns: 200 }));
    expect(presentation.status).toBe('READY');
    expect(presentation.headline).toContain('Neon Strip');
    expect(presentation.cta).toBe('Begin Operation');
  });

  it('presents ATTENTION when empire needs review', () => {
    const presentation = getCommandPresentation(mockState({
      turns: 10,
      prostituteHappiness: { score: 30, hashReadiness: 0.2, condomReadiness: 0.2, protectionReadiness: 0.2, weaponReadiness: 0, beerReadiness: 0, warnings: [] },
    }));
    expect(presentation.status).toBe('ATTENTION');
    expect(presentation.href).toBe('/empire');
  });
});
