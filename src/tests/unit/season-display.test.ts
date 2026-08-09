import { describe, it, expect } from 'vitest';
import { formatSeasonStatus, getSeasonDisplay, readinessStatus } from '@/lib/game/season-display';

describe('season display', () => {
  it('calculates 30-day season correctly', () => {
    const startsAt = new Date('2026-01-01T00:00:00Z');
    const endsAt = new Date('2026-01-31T00:00:00Z');
    const now = new Date('2026-01-01T12:00:00Z');

    const display = formatSeasonStatus(1, startsAt, endsAt, now);
    expect(display.totalDays).toBe(30);
    expect(display.currentDay).toBe(1);
    expect(display.dayLabel).toBe('Day 1 of 30');
    expect(display.label).toBe('Season 1');
  });

  it('shows days remaining from database dates', () => {
    const startsAt = new Date('2026-01-01T00:00:00Z');
    const endsAt = new Date('2026-01-31T00:00:00Z');
    const now = new Date('2026-01-15T00:00:00Z');

    const display = getSeasonDisplay(startsAt, endsAt, now);
    expect(display.daysRemaining).toBeGreaterThan(0);
    expect(display.daysRemaining).toBeLessThanOrEqual(16);
  });

  it('maps readiness scores to status labels', () => {
    expect(readinessStatus(75)).toBe('Operational');
    expect(readinessStatus(55)).toBe('Stable');
    expect(readinessStatus(40)).toBe('At risk');
    expect(readinessStatus(20)).toBe('Critical');
  });
});
