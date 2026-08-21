#!/usr/bin/env npx tsx
/**
 * Full-round economy simulation — analysis only, no balance changes.
 *
 *   npm run simulate:round -- --days=7 --runs=100
 *   npm run simulate:round -- --days=30 --runs=100
 *   npm run simulate:round -- --days=7 --runs=100 --seed=12345
 *   npm run simulate:round -- --sensitivity
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { canonicalConstantsTable, HYPOTHETICAL_SCENARIOS } from './lib/round-sim/constants';
import {
  runRoundSimulation,
  recoveryScenario,
  CHECKPOINTS_7,
  CHECKPOINTS_30,
  type SimPlayerResult,
} from './lib/round-sim/engine';
import {
  aggregateTotals,
  distribution,
  filterByActivity,
  filterByStrategy,
  fmtDist,
  fmtMoney,
  leaderboardSpread,
  summarizeAtDay,
} from './lib/round-sim/stats';
import type { ActivityLevel } from './lib/round-sim/profiles';

const OUT_DIR = join(process.cwd(), 'scripts/output');

function parseArgs() {
  const args = process.argv.slice(2);
  let days = 7;
  let runs = 100;
  let players = 100;
  let seed = 20260821;
  let sensitivity = false;
  for (const arg of args) {
    if (arg.startsWith('--days=')) days = Number(arg.split('=')[1]);
    else if (arg.startsWith('--runs=')) runs = Number(arg.split('=')[1]);
    else if (arg.startsWith('--players=')) players = Number(arg.split('=')[1]);
    else if (arg.startsWith('--seed=')) seed = Number(arg.split('=')[1]);
    else if (arg === '--sensitivity') sensitivity = true;
  }
  return { days, runs, players, seed, sensitivity };
}

function flattenRuns(allRuns: SimPlayerResult[][]): SimPlayerResult[] {
  return allRuns.flat();
}

function reportCheckpoints(players: SimPlayerResult[], checkpoints: readonly number[], label: string): string {
  const lines: string[] = [`### ${label}`];
  lines.push('| Day | NW P10/P25/med/P75/P90/max | Cash med | Workers med | Businesses % |');
  lines.push('|-----|---------------------------|----------|-------------|--------------|');
  for (const day of checkpoints) {
    const nw = summarizeAtDay(players, day, 'netWorth');
    const cash = summarizeAtDay(players, day, 'cash');
    const workers = summarizeAtDay(players, day, 'workers');
    const withBiz =
      players.filter((p) => (p.daily.find((d) => d.day === day)?.businesses ?? 0) > 0).length /
      players.length;
    lines.push(
      `| ${day} | ${fmtDist(nw)} | ${fmtMoney(cash.median)} | ${Math.round(workers.median)} | ${(withBiz * 100).toFixed(1)}% |`,
    );
  }
  return lines.join('\n');
}

function activityEndState(players: SimPlayerResult[], day: number, activity: ActivityLevel) {
  const subset = filterByActivity(players, activity);
  const nw = summarizeAtDay(subset, day, 'netWorth');
  const workers = summarizeAtDay(subset, day, 'workers');
  const thugs = summarizeAtDay(subset, day, 'thugs');
  return {
    activity,
    count: subset.length,
    nwMedian: nw.median,
    workersMedian: workers.median,
    thugsMedian: thugs.median,
    totals: aggregateTotals(subset),
  };
}

function main() {
  const { days, runs, players, seed, sensitivity } = parseArgs();
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Running baseline simulations…');
  const allRuns: SimPlayerResult[][] = [];
  for (let r = 0; r < runs; r++) {
    allRuns.push(runRoundSimulation({ days, playerCount: players, seed: seed + r * 9973 }));
    if ((r + 1) % 25 === 0) console.log(`  ${r + 1}/${runs} runs complete`);
  }
  const flat = flattenRuns(allRuns);
  const checkpoints = days <= 7 ? CHECKPOINTS_7 : CHECKPOINTS_30;
  const finalDay = days;

  const constants = canonicalConstantsTable();
  const totals = aggregateTotals(flat);
  const spread = leaderboardSpread(flat, finalDay);

  const recovery = {
    moderate: recoveryScenario('moderate'),
    major: recoveryScenario('major'),
    cashTheft: recoveryScenario('cash_theft'),
    crewLoss: recoveryScenario('crew_loss'),
  };

  const activityRows = (['CASUAL', 'REGULAR', 'ACTIVE', 'POWER'] as ActivityLevel[]).map((a) =>
    activityEndState(flat, finalDay, a),
  );

  const strategyRows = (['GROWTH', 'ECONOMY', 'AGGRESSIVE', 'BALANCED', 'INEFFICIENT'] as const).map(
    (s) => ({
      strategy: s,
      nwMedian: summarizeAtDay(filterByStrategy(flat, s), finalDay, 'netWorth').median,
      totals: aggregateTotals(filterByStrategy(flat, s)),
    }),
  );

  let sensitivityResults: Record<string, unknown> | undefined;
  if (sensitivity) {
    sensitivityResults = {};
    for (const scenario of HYPOTHETICAL_SCENARIOS) {
      const sample: SimPlayerResult[] = [];
      for (let r = 0; r < Math.min(30, runs); r++) {
        sample.push(
          ...runRoundSimulation({
            days,
            playerCount: players,
            seed: seed + 5000 + r * 9973,
            overrides: scenario,
          }),
        );
      }
      sensitivityResults[scenario.label] = {
        nwDay7: summarizeAtDay(sample, Math.min(7, days), 'netWorth'),
        nwFinal: summarizeAtDay(sample, finalDay, 'netWorth'),
        avgTurnsSpent: aggregateTotals(sample).avgTurnsSpent,
      };
    }
  }

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      days,
      runs,
      playersPerRun: players,
      totalPlayerSimulations: runs * players,
      baseSeed: seed,
      attackTurnCostsUsed: constants.attack.turnCosts,
    },
    canonicalConstants: constants,
    assumptions: {
      populationPerRun: players,
      activityProfiles: 'CASUAL/REGULAR/ACTIVE/POWER crossed with GROWTH/ECONOMY/AGGRESSIVE/BALANCED/INEFFICIENT',
      pvp: 'Same-district targets within NW range; 5-turn intel before each attack; resolveCombat canonical',
      businesses: 'Purchase when affordable; passive settleBusinessIncome; economy players collect safe at 55%+',
      banking: 'Economy/balanced deposit excess above threshold; breach steals street cash only',
      market: 'NOT simulated — drug sales use street prices only',
      factions: 'NOT simulated — no cartel defence in population PvP',
      offlineProtection: 'NOT simulated',
      dailyAttackCap: 'NOT enforced in sim (simplified)',
    },
    checkpoints: Object.fromEntries(
      checkpoints.map((day) => [
        day,
        {
          netWorth: summarizeAtDay(flat, day, 'netWorth'),
          cash: summarizeAtDay(flat, day, 'cash'),
          workers: summarizeAtDay(flat, day, 'workers'),
          thugs: summarizeAtDay(flat, day, 'thugs'),
          businesses: summarizeAtDay(flat, day, 'businesses'),
        },
      ]),
    ),
    finalDay: {
      leaderboard: spread,
      economyTotals: totals,
      activityProfiles: activityRows,
      strategies: strategyRows,
    },
    recovery,
    sensitivity: sensitivityResults,
    redFlags: [] as string[],
    yellowFlags: [] as string[],
    healthySystems: [] as string[],
  };

  // Heuristic flags from results
  if (spread.p90Gap > 4) report.redFlags.push(`P90/median NW ratio ${spread.p90Gap.toFixed(1)}× — large activity gap`);
  if (spread.top10Share > 0.35) report.yellowFlags.push(`Top 10 hold ${(spread.top10Share * 100).toFixed(0)}% of total NW`);
  if (totals.avgTurnsWasted > 200 * days) report.yellowFlags.push('Material turn cap waste at average activity');
  if (totals.playersWithBusiness / flat.length < 0.05 && days >= 30)
    report.yellowFlags.push('Fewer than 5% of players own a business by round end');
  if (totals.avgPvpCashGained > totals.avgScoutCash + totals.avgProduceCash)
    report.redFlags.push('PvP cash gain exceeds PvE income on average — attack-dominant meta risk');
  else report.healthySystems.push('PvE income exceeds average PvP extraction');

  if (summarizeAtDay(flat, finalDay, 'netWorth').max / Math.max(1, summarizeAtDay(flat, 7, 'netWorth').median) > 80)
    report.yellowFlags.push('Strong late-round NW acceleration vs Day 7 median');

  report.healthySystems.push('Turn regen + cap functioning');
  report.healthySystems.push('Scout/Produce use live resolveScouting/resolveProduction engines');

  const jsonPath = join(OUT_DIR, `round-sim-${days}d-${runs}r.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md: string[] = [];
  md.push('# Neon Underworld — Round Economy Simulation');
  md.push('');
  md.push(`**${runs} runs × ${players} players × ${days} days** (seed base ${seed})`);
  md.push('');
  md.push('## Canonical constants (from code)');
  md.push('');
  md.push('| Domain | Key values |');
  md.push('|--------|------------|');
  md.push(`| Starting | $${constants.starting.cash}, ${constants.starting.turns} turns, ${constants.starting.workers} workers, ${constants.starting.thugs} thugs |`);
  md.push(`| Turns | cap ${constants.turns.cap}, +${constants.turns.regenPerInterval}/${constants.turns.intervalMinutes}min (${constants.turns.perDay}/day) |`);
  md.push(`| Scout | ${(constants.scout.workerRatePerTurn * 100).toFixed(1)}% worker, ${(constants.scout.thugRatePerTurn * 100).toFixed(1)}% thug/turn, $${constants.scout.cashPerWorkerPerTurn}/worker/turn |`);
  md.push(`| Produce | $${constants.produce.cashPerWorkerPerTurn}/worker/turn |`);
  md.push(`| Attack costs | Strike ${constants.attack.turnCosts.DRIVE_BY}, Breach ${constants.attack.turnCosts.HOME_INVASION}, Raid ${constants.attack.turnCosts.RAID_DRUG_LABS}, Extraction ${constants.attack.turnCosts.POACH_WORKERS} |`);
  md.push(`| Intel | ${constants.attack.intelBasic} / ${constants.attack.intelDeep} turns |`);
  md.push(`| Businesses | Depot ${fmtMoney(constants.businesses.purchasePrices.WAREHOUSE)}, Club ${fmtMoney(constants.businesses.purchasePrices.NIGHTCLUB)}, Workshop ${fmtMoney(constants.businesses.purchasePrices.DRUG_LAB)} |`);
  md.push(`| NW unit values | worker $${constants.netWorth.worker}, thug $${constants.netWorth.thug}, ride $${constants.netWorth.vehicle}, drug $${constants.netWorth.drugUnit} |`);
  md.push('');
  md.push(reportCheckpoints(flat, checkpoints, `${days}-day checkpoints (P10→max NW)`));
  md.push('');
  md.push('## Activity profiles (final day median NW)');
  md.push('');
  for (const row of activityRows) {
    md.push(
      `- **${row.activity}** (n=${row.count}): NW ${fmtMoney(row.nwMedian)}, workers ${Math.round(row.workersMedian)}, thugs ${Math.round(row.thugsMedian)}, turns spent/day ~${Math.round(row.totals.avgTurnsSpent / days)}`,
    );
  }
  md.push('');
  md.push('## Strategy archetypes (final day median NW)');
  for (const row of strategyRows) {
    md.push(`- **${row.strategy}**: NW ${fmtMoney(row.nwMedian)}, attacks ${row.totals.avgAttacks.toFixed(1)}, business spend ${fmtMoney(row.totals.avgBusinessPurchases)}`);
  }
  md.push('');
  md.push('## Economy totals (per player average)');
  md.push(`- Scout cash: ${fmtMoney(totals.avgScoutCash)} | Produce cash: ${fmtMoney(totals.avgProduceCash)} | Drug sales: ${fmtMoney(totals.avgDrugSales)}`);
  md.push(`- Shop spend: ${fmtMoney(totals.avgShopSpend)} | Bank deposited: ${fmtMoney(totals.avgBankDeposited)}`);
  md.push(`- PvP gained: ${fmtMoney(totals.avgPvpCashGained)} | PvP lost: ${fmtMoney(totals.avgPvpCashLost)} | Attacks: ${totals.avgAttacks.toFixed(1)}`);
  md.push(`- Turns spent: ${Math.round(totals.avgTurnsSpent)} | Wasted (cap): ${Math.round(totals.avgTurnsWasted)}`);
  md.push('');
  md.push('## Recovery (single REGULAR/BALANCED player, post Day 14 setback)');
  md.push(`- Moderate loss: ${recovery.moderate.daysToRecover} days, ~${recovery.moderate.turnsToRecover} turns spent to recover NW`);
  md.push(`- Major loss: ${recovery.major.daysToRecover} days`);
  md.push(`- Cash theft: ${recovery.cashTheft.daysToRecover} days`);
  md.push(`- Crew loss: ${recovery.crewLoss.daysToRecover} days`);
  md.push('');
  md.push('## Flags');
  md.push('**RED:** ' + (report.redFlags.length ? report.redFlags.join('; ') : 'none auto-detected'));
  md.push('**YELLOW:** ' + (report.yellowFlags.length ? report.yellowFlags.join('; ') : 'none auto-detected'));
  md.push('**HEALTHY:** ' + report.healthySystems.join('; '));
  md.push('');
  md.push('## Limitations');
  md.push('- Market auctions, faction defence, offline protection, admin round activation not simulated');
  md.push('- Player behaviour is modelled, not human playtest data');
  md.push('- Business heat/raids not simulated in population loop');
  md.push('');
  md.push(`Full JSON: \`${jsonPath}\``);

  const mdPath = join(OUT_DIR, `round-sim-${days}d-${runs}r.md`);
  writeFileSync(mdPath, md.join('\n'));

  console.log('\n' + md.join('\n'));
  console.log(`\nWrote ${jsonPath}`);
}

main();
