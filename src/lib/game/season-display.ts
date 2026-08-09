export interface SeasonDisplay {
  number: number;
  totalDays: number;
  currentDay: number;
  daysRemaining: number;
  label: string;
  dayLabel: string;
  remainingLabel: string;
}

export function getSeasonDisplay(startsAt: Date, endsAt: Date, now: Date = new Date()): SeasonDisplay {
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / msPerDay));
  const elapsed = Math.max(0, now.getTime() - startsAt.getTime());
  const currentDay = Math.min(totalDays, Math.max(1, Math.floor(elapsed / msPerDay) + 1));
  const daysRemaining = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / msPerDay));

  return {
    number: 0, // filled by caller
    totalDays,
    currentDay,
    daysRemaining,
    label: '', // filled by caller
    dayLabel: `Day ${currentDay} of ${totalDays}`,
    remainingLabel: daysRemaining === 1 ? '1 day remaining' : `${daysRemaining} days remaining`,
  };
}

export function formatSeasonStatus(
  seasonNumber: number,
  startsAt: Date,
  endsAt: Date,
  now?: Date,
): SeasonDisplay {
  const display = getSeasonDisplay(startsAt, endsAt, now);
  return {
    ...display,
    number: seasonNumber,
    label: `Season ${seasonNumber}`,
  };
}

export function readinessStatus(score: number): 'Operational' | 'Stable' | 'At risk' | 'Critical' {
  if (score >= 70) return 'Operational';
  if (score >= 50) return 'Stable';
  if (score >= 35) return 'At risk';
  return 'Critical';
}

export function readinessVariant(score: number): 'success' | 'default' | 'warning' | 'danger' {
  if (score >= 70) return 'success';
  if (score >= 50) return 'default';
  if (score >= 35) return 'warning';
  return 'danger';
}
