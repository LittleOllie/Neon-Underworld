#!/usr/bin/env npx tsx
/**
 * Business Recruitment Network — 30-day progression simulation.
 * Run: npx tsx scripts/business-recruitment-network-sim.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  calculateBusinessNetworkBonus,
  getBusinessTierRecruitmentContribution,
  MAX_THUG_RECRUITMENT_BONUS_PERCENT,
  MAX_WORKER_RECRUITMENT_BONUS_PERCENT,
} from '../src/config/game/business-recruitment-rules';
import {
  businessPurchasePrice,
  getBusinessUpgradeCost,
  getBusinessLevelStats,
  businessHourlyIncome,
} from '../src/config/game/business-rules';
import { resolveScouting } from '../src/lib/game-engine/scouting';
import { happinessRecruitmentModifier } from '../src/lib/game-engine/happiness';
import {
  DISTRICTS,
  SCOUTING_CONFIG,
  STARTING_RESOURCES,
  TURNS_CONFIG,
} from '../src/config/game/balance';
import { REDLITE_SCOUT_AREAS, REDLITE_PRODUCTION } from '../src/config/game/redlite-rules';
import { grossWorkerCash, playerCashFromGross } from '../src/lib/game-engine/worker-economics';
import { happinessEfficiencyModifier } from '../src/lib/game-engine/happiness';

const OUT_DIR = join(process.cwd(), 'scripts/output');
const TURNS_PER_DAY = Math.floor(TURNS_CONFIG.regenerationRatePerMs * 86_400_000);
const CHECKPOINT_DAYS = [1, 7, 15, 21, 30] as const;
const neon = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;
const clubs = REDLITE_SCOUT_AREAS.find((a) => a.slug === 'clubs')!;
const docks = REDLITE_SCOUT_AREAS.find((a) => a.slug === 'docks')!;

type BizState = { businessType: 'WAREHOUSE' | 'NIGHTCLUB' | 'DRUG_LAB'; level: number };

type Style = {
  id: string;
  activityRate: number;
  scoutShare: number;
  workerArea: 'clubs' | 'docks';
  businessPriority: 'none' | 'mixed' | 'worker' | 'thug';
  reserveCashFraction: number;
};

const STYLES: Style[] = [
  { id: 'casual', activityRate: 0.32, scoutShare: 0.5, workerArea: 'clubs', businessPriority: 'none', reserveCashFraction: 0.35 },
  { id: 'regular', activityRate: 0.68, scoutShare: 0.5, workerArea: 'clubs', businessPriority: 'mixed', reserveCashFraction: 0.25 },
  { id: 'active', activityRate: 0.9, scoutShare: 0.5, workerArea: 'clubs', businessPriority: 'mixed', reserveCashFraction: 0.2 },
  { id: 'business-focused', activityRate: 0.85, scoutShare: 0.65, workerArea: 'clubs', businessPriority: 'worker', reserveCashFraction: 0.15 },
  { id: 'pvp-focused', activityRate: 0.8, scoutShare: 0.45, workerArea: 'docks', businessPriority: 'thug', reserveCashFraction: 0.2 },
  { id: 'extreme-scout', activityRate: 0.98, scoutShare: 0.92, workerArea: 'clubs', businessPriority: 'none', reserveCashFraction: 0.4 },
];

function analyticalWorkersPer100(happiness: number, areaSlug: 'clubs' | 'docks', network = calculateBusinessNetworkBonus([])) {
  const area = areaSlug === 'clubs' ? clubs : docks;
  const mod = happinessRecruitmentModifier(happiness, happiness);
  return (
    100 *
    SCOUTING_CONFIG.baseProstitutesPerTurn *
    neon.prostituteRecruitment *
    area.prostituteRecruitment *
    mod *
    network.workerMultiplier
  );
}

function scoutChunk(
  turns: number,
  workers: number,
  thugs: number,
  happiness: number,
  areaSlug: 'clubs' | 'docks',
  network: ReturnType<typeof calculateBusinessNetworkBonus>,
  seed: number,
) {
  const outcome = resolveScouting({
    turnsSpent: turns,
    districtModifiers: neon,
    districtSlug: 'neon-strip',
    areaSlug,
    prostituteHappiness: happiness,
    thugHappiness: happiness,
    prostituteCount: workers,
    thugCount: thugs,
    prostitutePayoutPercent: 50,
    seed,
    businessNetwork: network,
  });
  return outcome;
}

function produceCash(workers: number, turns: number, happiness: number) {
  const gross = grossWorkerCash(workers, turns);
  const eff = happinessEfficiencyModifier(happiness);
  return Math.floor(playerCashFromGross(gross, 50) * eff);
}

function nextBusinessPurchase(priority: Style['businessPriority'], owned: BizState[]): BizState['businessType'] | null {
  if (priority === 'none') return null;
  const counts = {
    WAREHOUSE: owned.filter((b) => b.businessType === 'WAREHOUSE').length,
    NIGHTCLUB: owned.filter((b) => b.businessType === 'NIGHTCLUB').length,
    DRUG_LAB: owned.filter((b) => b.businessType === 'DRUG_LAB').length,
  };
  if (owned.length >= 8) return null;
  if (priority === 'worker') {
    if (counts.WAREHOUSE === 0) return 'WAREHOUSE';
    if (counts.NIGHTCLUB === 0) return 'NIGHTCLUB';
    return counts.WAREHOUSE <= counts.NIGHTCLUB ? 'WAREHOUSE' : 'NIGHTCLUB';
  }
  if (priority === 'thug') {
    if (counts.DRUG_LAB === 0) return 'DRUG_LAB';
    if (counts.NIGHTCLUB === 0) return 'NIGHTCLUB';
    return 'DRUG_LAB';
  }
  if (counts.NIGHTCLUB === 0) return 'NIGHTCLUB';
  if (counts.WAREHOUSE === 0) return 'WAREHOUSE';
  if (counts.DRUG_LAB === 0) return 'DRUG_LAB';
  return 'NIGHTCLUB';
}

function tryInvest(state: {
  cash: number;
  businesses: BizState[];
  style: Style;
}) {
  const reserve = state.cash * state.style.reserveCashFraction;
  let spendable = state.cash - reserve;

  for (let attempt = 0; attempt < 4; attempt++) {
    let upgraded = false;
    for (const biz of [...state.businesses].sort((a, b) => a.level - b.level)) {
      if (biz.level >= 5) continue;
      const cost = getBusinessUpgradeCost(biz.businessType, biz.level + 1);
      if (spendable >= cost) {
        spendable -= cost;
        state.cash -= cost;
        biz.level += 1;
        upgraded = true;
        break;
      }
    }
    if (upgraded) continue;

    const type = nextBusinessPurchase(state.style.businessPriority, state.businesses);
    if (!type) break;
    const price = businessPurchasePrice(type);
    if (spendable >= price) {
      spendable -= price;
      state.cash -= price;
      state.businesses.push({ businessType: type, level: 1 });
    } else {
      break;
    }
  }
}

function simulateStyle(style: Style, seed: number) {
  let turns = TURNS_CONFIG.startingTurns;
  let cash = STARTING_RESOURCES.cash;
  let workers = STARTING_RESOURCES.prostitutes;
  let thugs = STARTING_RESOURCES.thugs;
  let businesses: BizState[] = [];
  let assignedWorkers = 0;
  const snapshots: Record<number, object> = {};
  let seedCursor = seed;

  for (let day = 1; day <= 30; day++) {
    turns = Math.min(TURNS_CONFIG.turnCap, turns + TURNS_PER_DAY);
    const dailySpend = Math.floor(turns * style.activityRate);
    const scoutTurns = Math.floor(dailySpend * style.scoutShare);
    const produceTurns = dailySpend - scoutTurns;
    const happiness = 82;

    const network = calculateBusinessNetworkBonus(businesses);
    if (scoutTurns > 0) {
      const chunk = scoutChunk(scoutTurns, workers, thugs, happiness, style.workerArea, network, seedCursor++);
      workers += chunk.prostitutesFound - chunk.prostitutesLost;
      thugs += chunk.thugsFound - chunk.thugsLost;
      cash += chunk.cashEarned;
      turns -= scoutTurns;
    }
    if (produceTurns > 0 && workers > 0) {
      cash += produceCash(workers, produceTurns, happiness);
      turns -= produceTurns;
    }

    tryInvest({ cash, businesses, style });

    const postNetwork = calculateBusinessNetworkBonus(businesses);
    let capacity = 0;
    for (const biz of businesses) {
      capacity += getBusinessLevelStats(biz.businessType, biz.level).workerCapacity;
    }
    assignedWorkers = Math.min(workers, capacity);
    for (const biz of businesses) {
      const cap = getBusinessLevelStats(biz.businessType, biz.level).workerCapacity;
      const assign = Math.min(cap, Math.max(0, assignedWorkers));
      assignedWorkers -= assign;
      cash += businessHourlyIncome(biz.businessType, assign, biz.level) * 24 * 0.35;
    }

    if ((CHECKPOINT_DAYS as readonly number[]).includes(day)) {
      snapshots[day] = {
        day,
        workers,
        thugs,
        crew: workers + thugs,
        cash: Math.round(cash),
        businesses: businesses.map((b) => `${b.businessType.slice(0, 3)} L${b.level}`),
        businessCount: businesses.length,
        workerCapacity: postNetwork.totalWorkerCapacity,
        assignedWorkers: Math.min(workers, postNetwork.totalWorkerCapacity),
        workerNetworkBonus: postNetwork.workerBonusPercent,
        thugNetworkBonus: postNetwork.thugBonusPercent,
      };
    }
  }

  return snapshots;
}

function preChangeTable() {
  const happiness = 80;
  const rows = [25, 50, 100, 250].map((turns) => ({
    turns,
    clubsWorkersPer100: analyticalWorkersPer100(happiness, 'clubs'),
    docksThugsPer100:
      100 *
      SCOUTING_CONFIG.baseThugsPerTurn *
      neon.thugRecruitment *
      docks.thugRecruitment *
      happinessRecruitmentModifier(happiness, happiness),
  }));
  return rows;
}

function bonusModelComparison() {
  const models = [
    { label: '+50% cap', cap: 50, scale: 1 },
    { label: '+100% cap', cap: 100, scale: 1 },
    { label: 'selected (+125% cap)', cap: 125, scale: 1 },
  ];
  const empire = [
    { businessType: 'WAREHOUSE' as const, level: 5 },
    { businessType: 'WAREHOUSE' as const, level: 4 },
    { businessType: 'NIGHTCLUB' as const, level: 5 },
    { businessType: 'NIGHTCLUB' as const, level: 3 },
    { businessType: 'DRUG_LAB' as const, level: 5 },
  ];
  return models.map((model) => {
    const raw = calculateBusinessNetworkBonus(empire);
    return {
      model: model.label,
      workerBonus: Math.min(model.cap, raw.workerBonusPercent),
      thugBonus: Math.min(model.cap, raw.thugBonusPercent),
      day30WorkersEstimate: Math.round(analyticalWorkersPer100(82, 'clubs', raw) * 30 * 0.68 * 0.5),
    };
  });
}

console.log('Running Business Recruitment Network simulation...\n');

const preChange = preChangeTable();
const bonusModels = bonusModelComparison();
const styleRuns = Object.fromEntries(
  STYLES.map((style) => [style.id, simulateStyle(style, 50_000 + style.id.length * 997)]),
);

const tierTable = ([1, 2, 3, 4, 5] as const).map((level) => ({
  level,
  warehouse: getBusinessTierRecruitmentContribution('WAREHOUSE', level),
  nightclub: getBusinessTierRecruitmentContribution('NIGHTCLUB', level),
  drugLab: getBusinessTierRecruitmentContribution('DRUG_LAB', level),
}));

const maxTheoretical = calculateBusinessNetworkBonus([
  ...Array.from({ length: 4 }, () => ({ businessType: 'WAREHOUSE' as const, level: 5 })),
  ...Array.from({ length: 4 }, () => ({ businessType: 'NIGHTCLUB' as const, level: 5 })),
]);

const output = {
  generatedAt: new Date().toISOString(),
  turnsPerDay: TURNS_PER_DAY,
  preChangeScoutYields: preChange,
  tierContributions: tierTable,
  selectedFormula: {
    stackingWeights: [1, 0.35, 0.18, 0.1, 0.06, 0.04, 0.03, 0.02],
    maxWorkerBonusPercent: MAX_WORKER_RECRUITMENT_BONUS_PERCENT,
    maxThugBonusPercent: MAX_THUG_RECRUITMENT_BONUS_PERCENT,
    integrationOrder:
      'base rate × district × area × morale × business network multiplier × per-turn variance',
    cashUnchanged: true,
  },
  bonusModelComparison: bonusModels,
  maxTheoreticalMixedEmpire: maxTheoretical,
  styleCheckpoints: styleRuns,
  affordability: {
    warehouseL1: businessPurchasePrice('WAREHOUSE'),
    nightclubL1: businessPurchasePrice('NIGHTCLUB'),
    drugLabL1: businessPurchasePrice('DRUG_LAB'),
    warehouseL1UpgradeL2: getBusinessUpgradeCost('WAREHOUSE', 2),
  },
};

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, 'business-recruitment-network-sim.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log('Pre-change scout yields (workers per 100 turns, clubs, 80% morale):');
for (const row of preChange) {
  console.log(`  ${row.turns} turns → ~${row.clubsWorkersPer100.toFixed(1)} workers`);
}

console.log('\nSelected tier contributions (% points, single business):');
for (const row of tierTable) {
  console.log(
    `  L${row.level}: WH W+${row.warehouse.workerPercent}% | NC W+${row.nightclub.workerPercent}% T+${row.nightclub.thugPercent}% | DL T+${row.drugLab.thugPercent}%`,
  );
}

console.log('\n30-day checkpoints:');
for (const style of STYLES) {
  console.log(`\n  ${style.id.toUpperCase()}`);
  for (const day of CHECKPOINT_DAYS) {
    const snap = styleRuns[style.id]![day] as Record<string, unknown>;
    console.log(
      `    Day ${day}: ${snap.workers}W / ${snap.thugs}T | cash $${Number(snap.cash).toLocaleString()} | network W+${snap.workerNetworkBonus}% T+${snap.thugNetworkBonus}% | ${(snap.businesses as string[]).join(', ') || 'none'}`,
    );
  }
}

console.log(`\nWrote ${outPath}`);
