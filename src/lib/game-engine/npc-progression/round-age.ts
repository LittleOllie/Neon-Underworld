import { getSeasonDisplay } from '@/lib/game/season-display';

export function getSeasonRoundDay(
  startsAt: Date,
  endsAt: Date,
  now: Date = new Date(),
): number {
  return getSeasonDisplay(startsAt, endsAt, now).currentDay;
}

export function effectiveRecoveryRate(daysElapsed: number, dailyRate: number): number {
  if (daysElapsed <= 0) return 0;
  if (daysElapsed === 1) return dailyRate;
  return 1 - Math.pow(1 - dailyRate, daysElapsed);
}
