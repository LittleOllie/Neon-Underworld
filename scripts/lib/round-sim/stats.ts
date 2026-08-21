import type { DailyMetrics, SimPlayerResult } from './engine';
import type { ActivityLevel, StrategyArchetype } from './profiles';

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx]!;
}

export interface Distribution {
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
}

export function distribution(values: number[]): Distribution {
  return {
    p10: percentile(values, 10),
    p25: percentile(values, 25),
    median: percentile(values, 50),
    p75: percentile(values, 75),
    p90: percentile(values, 90),
    max: values.length ? Math.max(...values) : 0,
  };
}

export function metricAtDay(players: SimPlayerResult[], day: number, pick: (d: DailyMetrics) => number): number[] {
  return players
    .map((p) => p.daily.find((d) => d.day === day))
    .filter((d): d is DailyMetrics => !!d)
    .map(pick);
}

export function summarizeAtDay(players: SimPlayerResult[], day: number, field: keyof DailyMetrics): Distribution {
  return distribution(
    metricAtDay(players, day, (d) => d[field] as number),
  );
}

export function filterByActivity(players: SimPlayerResult[], activity: ActivityLevel): SimPlayerResult[] {
  return players.filter((p) => p.profile.activity === activity);
}

export function filterByStrategy(players: SimPlayerResult[], strategy: StrategyArchetype): SimPlayerResult[] {
  return players.filter((p) => p.profile.strategy === strategy);
}

export function aggregateTotals(players: SimPlayerResult[]) {
  const sum = (fn: (p: SimPlayerResult) => number) => players.reduce((s, p) => s + fn(p), 0);
  const n = players.length || 1;
  return {
    avgTurnsSpent: sum((p) => p.totals.turnsSpent) / n,
    avgTurnsWasted: sum((p) => p.totals.turnsWasted) / n,
    avgScoutCash: sum((p) => p.totals.scoutCash) / n,
    avgProduceCash: sum((p) => p.totals.produceCash) / n,
    avgDrugSales: sum((p) => p.totals.drugSales) / n,
    avgShopSpend: sum((p) => p.totals.shopSpend) / n,
    avgPvpCashGained: sum((p) => p.totals.pvpCashGained) / n,
    avgPvpCashLost: sum((p) => p.totals.pvpCashLost) / n,
    avgAttacks: sum((p) => p.totals.attacksLaunched) / n,
    avgBusinessPurchases: sum((p) => p.totals.businessPurchases) / n,
    avgBankDeposited: sum((p) => p.totals.bankDeposited) / n,
    playersWithBusiness: players.filter((p) => p.daily.at(-1)?.businesses ?? 0 > 0).length,
  };
}

export function leaderboardSpread(players: SimPlayerResult[], day: number) {
  const nw = metricAtDay(players, day, (d) => d.netWorth);
  const dist = distribution(nw);
  const sorted = [...nw].sort((a, b) => b - a);
  const top10Share =
    sorted.slice(0, 10).reduce((s, v) => s + v, 0) / Math.max(1, sorted.reduce((s, v) => s + v, 0));
  return { ...dist, top10Share, p90Gap: dist.p90 / Math.max(1, dist.median) };
}

export function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return `$${Math.round(n)}`;
}

export function fmtDist(d: Distribution, prefix = ''): string {
  return `${prefix}${Math.round(d.p10).toLocaleString()} / ${prefix}${Math.round(d.p25).toLocaleString()} / ${prefix}${Math.round(d.median).toLocaleString()} / ${prefix}${Math.round(d.p75).toLocaleString()} / ${prefix}${Math.round(d.p90).toLocaleString()} / ${prefix}${Math.round(d.max).toLocaleString()}`;
}
