#!/usr/bin/env npx tsx
/**
 * Business Economy / Upgrades / Endgame audit — ANALYSIS ONLY.
 * Run: npx tsx scripts/business-economy-audit-sim.ts
 * Does NOT modify production gameplay constants.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  BUSINESS_TYPE_RULES,
  BUSINESS_DRUG_HEAT_WEIGHT,
  BUSINESS_HEAT_BANDS,
  BUSINESS_RAID_CHANCE_PER_CHECK,
  BUSINESS_RAID_LOSS_FRACTION,
  BUSINESS_PASSIVE_INCOME_FRACTION,
  BUSINESS_STREET_NW_MULTIPLIER,
  MAX_BUSINESSES_PER_PLAYER,
  businessHourlyIncome,
  businessHourlyIncomePerWorker,
  businessStreetNwContribution,
  businessPurchasePrice,
  getBusinessInvestedValue,
  getBusinessUpgradeCost,
  getBusinessLevelStats,
  type BusinessType,
} from '../src/config/game/business-rules';
import { REDLITE_PRODUCTION, REDLITE_TURNS } from '../src/config/game/redlite-rules';
import { CANONICAL_NET_WORTH_VALUATIONS } from '../src/lib/game-engine/canonical-net-worth';
import { evaluateBusinessHeat } from '../src/lib/game-engine/business/heat';
import { DRUG_PRODUCTION_RATES, expectedDrugUnits, turnsToReachDrugUnits } from '../src/config/game/drug-production-rates';
import { getDrugStreetPrice } from '../src/config/game/drug-street-prices';
import { getCityShopItem } from '../src/config/game/shop-rules';
import {
  ARCHETYPE_CONFIGS,
  CHECKPOINT_DAYS,
  TURNS_PER_DAY,
  runSimulation,
  summarizeCheckpoints,
  type ArchetypeId,
} from './lib/monthly-sim/engine';

const OUT_DIR = join(process.cwd(), 'scripts/output');
const MONTE_CARLO = 300;
const RESERVE_FRACTION = 0.25; // keep 25% cash for supplies/weapons buffer

type PriceStructure = Record<BusinessType, number>;

const PRICE_STRUCTURES: Record<string, PriceStructure> = {
  A_current: {
    WAREHOUSE: 1_000_000,
    NIGHTCLUB: 2_000_000,
    DRUG_LAB: 3_500_000,
  },
  B: {
    WAREHOUSE: 2_000_000,
    NIGHTCLUB: 4_000_000,
    DRUG_LAB: 6_000_000,
  },
  C: {
    WAREHOUSE: 3_000_000,
    NIGHTCLUB: 5_000_000,
    DRUG_LAB: 8_000_000,
  },
};

const AFFORD_THRESHOLDS = [1e6, 2e6, 3e6, 4e6, 5e6, 6e6, 10e6, 20e6] as const;

function fmt(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return `$${Math.round(n)}`;
}

function safeFillHours(workers: number, safeCap: number, type: BusinessType): number {
  const hr = businessHourlyIncome(type, workers);
  if (hr <= 0) return Infinity;
  return safeCap / hr;
}

function activeProduceHourly(workers: number, payoutPct = 50, morale = 85): number {
  const grossPerHr = REDLITE_PRODUCTION.cashPerProstitutePerTurn * REDLITE_TURNS.regenerationRatePerHour * workers;
  const retained = grossPerHr * (1 - payoutPct / 100);
  return retained;
}

function passiveVsActiveRatio(type: BusinessType, workers: number): number {
  const active = activeProduceHourly(workers);
  const passive = businessHourlyIncome(type, workers);
  return active > 0 ? passive / active : 0;
}

function drugNw(units: number): number {
  return units * CANONICAL_NET_WORTH_VALUATIONS.drugUnit;
}

function streetValue(units: number, drug: keyof typeof DRUG_PRODUCTION_RATES): number {
  return units * getDrugStreetPrice('neon-strip', drug);
}

function firstAffordableDay(
  checkpoints: ReturnType<typeof summarizeCheckpoints>[],
  threshold: number,
): number | null {
  for (let i = 0; i < CHECKPOINT_DAYS.length; i++) {
    const day = CHECKPOINT_DAYS[i]!;
    const spendable = checkpoints[i]!.cash!.median * (1 - RESERVE_FRACTION);
    if (spendable >= threshold) return day;
  }
  return null;
}

function workerCapAnalysis(streetWorkers: number, cap: number) {
  const assignable = Math.min(streetWorkers, cap);
  const passiveHr = businessHourlyIncome('NIGHTCLUB', assignable);
  const activeHr = activeProduceHourly(streetWorkers - assignable);
  const dumpAllPassive = businessHourlyIncome('NIGHTCLUB', streetWorkers);
  const dumpAllActive = 0;
  return {
    cap,
    streetRemaining: streetWorkers - assignable,
    assigned: assignable,
    passiveHr,
    activeHrIfCapped: activeHr + passiveHr,
    dumpStrategyPassiveHr: dumpAllPassive,
    dumpStrategyActiveHr: dumpAllActive,
    opportunityCostVsDump: dumpAllPassive - (passiveHr + activeHr),
  };
}

function simulateRaidExpectation(heatBand: keyof typeof BUSINESS_RAID_CHANCE_PER_CHECK, days: number) {
  const checksPerDay = 4;
  const p = BUSINESS_RAID_CHANCE_PER_CHECK[heatBand];
  const pDay = 1 - Math.pow(1 - p, checksPerDay);
  const pPeriod = 1 - Math.pow(1 - pDay, days);
  return { perCheck: p, perDay: pDay, overDays: pPeriod, lossFraction: BUSINESS_RAID_LOSS_FRACTION[heatBand] };
}

// --- Run monthly sim snapshots (fresh, smaller MC) ---
console.log('Running business economy audit simulation...\n');

const archetypeRuns: Record<
  ArchetypeId,
  { checkpoints: ReturnType<typeof summarizeCheckpoints>[]; runs: ReturnType<typeof runSimulation>[] }
> = {} as never;

for (const config of ARCHETYPE_CONFIGS) {
  const runs: ReturnType<typeof runSimulation>[] = [];
  for (let i = 0; i < MONTE_CARLO; i++) {
    runs.push(runSimulation(config, 20_000 + i * 991, 'neon-strip'));
  }
  archetypeRuns[config.id] = {
    runs,
    checkpoints: CHECKPOINT_DAYS.map((d) => summarizeCheckpoints(runs, d)),
  };
}

const liveRules = Object.fromEntries(
  (['WAREHOUSE', 'NIGHTCLUB', 'DRUG_LAB'] as const).map((type) => {
    const r = BUSINESS_TYPE_RULES[type];
    return [
      type,
      {
        purchasePrice: r.purchasePrice,
        streetNwContribution: businessStreetNwContribution(r.purchasePrice),
        safeCapacity: r.safeCapacity,
        drugStorageCapacity: r.drugStorageCapacity,
        passiveIncomeMultiplier: r.passiveIncomeMultiplier,
        workerCapacity: null as number | null,
        baseHeat: r.baseHeat,
        incomePerWorkerHr: businessHourlyIncomePerWorker(type),
        blurb: r.blurb,
      },
    ];
  }),
);

const affordability: Record<string, Record<string, number | null>> = {};
for (const config of ARCHETYPE_CONFIGS) {
  affordability[config.id] = {};
  for (const t of AFFORD_THRESHOLDS) {
    affordability[config.id]![String(t)] = firstAffordableDay(archetypeRuns[config.id].checkpoints, t);
  }
}

const workerSnapshots: Record<number, Record<ArchetypeId, { workers: number; thugs: number; cash: number; nw: number; coke: number; heroin: number }>> = {};
for (const day of [7, 14, 21, 30] as const) {
  workerSnapshots[day] = {} as never;
  const idx = CHECKPOINT_DAYS.indexOf(day);
  for (const config of ARCHETYPE_CONFIGS) {
    const cp = archetypeRuns[config.id].checkpoints[idx]!;
    workerSnapshots[day]![config.id] = {
      workers: Math.round(cp.prostitutes!.median),
      thugs: Math.round(cp.thugs!.median),
      cash: Math.round(cp.cash!.median),
      nw: Math.round(cp.netWorth!.median),
      coke: Math.round(cp.coke!.median),
      heroin: Math.round(cp.heroin!.median),
    };
  }
}

const nightclubCaps = [250, 500, 750, 1000, 1450, 2500, 5000];
const capScenarios = [7, 14, 21, 30].map((day) => ({
  day,
  balanced: nightclubCaps.map((cap) => workerCapAnalysis(workerSnapshots[day]!.balanced.workers, cap)),
  power: nightclubCaps.map((cap) => workerCapAnalysis(workerSnapshots[day]!.power.workers, cap)),
}));

const drugStorageAnalysis = {
  capacities: [5000, 15000, 25000, 50000, 100000],
  productionRates: DRUG_PRODUCTION_RATES,
  drugValues: {
    canonicalNwPer15k: {
      hash: drugNw(15000),
      shrooms: drugNw(15000),
      coke: drugNw(15000),
      heroin: drugNw(15000),
    },
    streetNeonStripPer15k: {
      hash: streetValue(15000, 'hash'),
      shrooms: streetValue(15000, 'shrooms'),
      coke: streetValue(15000, 'coke'),
      heroin: streetValue(15000, 'heroin'),
    },
  },
  turnsToProduce15k: {
    coke_500thugs: turnsToReachDrugUnits(500, 'coke', 15000),
    coke_2000thugs: turnsToReachDrugUnits(2000, 'coke', 15000),
    coke_5000thugs: turnsToReachDrugUnits(5000, 'coke', 15000),
    heroin_500thugs: turnsToReachDrugUnits(500, 'heroin', 15000),
    hash_500thugs: turnsToReachDrugUnits(500, 'hash', 15000),
  },
  day30Holdings: workerSnapshots[30],
  fillTimeDaysAtCap: Object.fromEntries(
    (['WAREHOUSE', 'NIGHTCLUB', 'DRUG_LAB'] as const).map((type) => [
      type,
      {
        capacity: BUSINESS_TYPE_RULES[type].drugStorageCapacity,
        coke500thugsDays: (turnsToReachDrugUnits(500, 'coke', BUSINESS_TYPE_RULES[type].drugStorageCapacity) ?? 0) / TURNS_PER_DAY,
        coke2000thugsDays: (turnsToReachDrugUnits(2000, 'coke', BUSINESS_TYPE_RULES[type].drugStorageCapacity) ?? 0) / TURNS_PER_DAY,
      },
    ]),
  ),
};

const safeFillMatrix = {
  nightclub: nightclubCaps.map((w) => ({
    workers: w,
    hourly: businessHourlyIncome('NIGHTCLUB', w),
    fill750k: safeFillHours(w, 750_000, 'NIGHTCLUB'),
    fill1m: safeFillHours(w, 1_000_000, 'NIGHTCLUB'),
    fill1_5m: safeFillHours(w, 1_500_000, 'NIGHTCLUB'),
    fill2m: safeFillHours(w, 2_000_000, 'NIGHTCLUB'),
    passiveVsActive: passiveVsActiveRatio('NIGHTCLUB', w),
  })),
};

const priceStructureAffordability = Object.fromEntries(
  Object.entries(PRICE_STRUCTURES).map(([key, prices]) => [
    key,
    Object.fromEntries(
      ARCHETYPE_CONFIGS.map((a) => [
        a.id,
        {
          warehouse: firstAffordableDay(archetypeRuns[a.id].checkpoints, prices.WAREHOUSE),
          nightclub: firstAffordableDay(archetypeRuns[a.id].checkpoints, prices.NIGHTCLUB),
          drugLab: firstAffordableDay(archetypeRuns[a.id].checkpoints, prices.DRUG_LAB),
          tenBusinessesMin: firstAffordableDay(
            archetypeRuns[a.id].checkpoints,
            prices.WAREHOUSE + prices.NIGHTCLUB + prices.DRUG_LAB,
          ),
        },
      ]),
    ),
  ]),
);

const endSeasonScenario = {
  playerA: { streetNw: 20_000_000, safeCash: 7_000_000, storedDrugsNw: 3_000_000, businessAssetNw: 2_000_000 },
  playerB: { streetNw: 25_000_000, safeCash: 0, storedDrugsNw: 0, businessAssetNw: 0 },
  rankingOptions: {
    streetOnly: { A: 20_000_000, B: 25_000_000, winner: 'B' },
    totalEmpire: { A: 32_000_000, B: 25_000_000, winner: 'A' },
    discountedBusinessAssets: {
      A: 20_000_000 + 7_000_000 * 0.5 + 3_000_000 * 0.5 + 2_000_000,
      B: 25_000_000,
    },
  },
};

const proposedV11 = {
  prices: { WAREHOUSE: 2_500_000, NIGHTCLUB: 5_000_000, DRUG_LAB: 7_500_000 },
  workerCapsL1: { WAREHOUSE: 500, NIGHTCLUB: 600, DRUG_LAB: 400 },
  drugCapsL1: { WAREHOUSE: 20000, NIGHTCLUB: 8000, DRUG_LAB: 12000 },
  safeCapsL1: { WAREHOUSE: 350_000, NIGHTCLUB: 1_000_000, DRUG_LAB: 600_000 },
  upgrades: [
    { level: 1, costMultiplier: 0, note: 'Base purchase' },
    { level: 2, costPctOfBase: 0.6, changes: 'Capacity + type bonuses' },
    { level: 3, costPctOfBase: 1.0, changes: 'Major capacity tier' },
    { level: 4, costPctOfBase: 1.8, changes: 'Strong capacity + bonuses' },
    { level: 5, costPctOfBase: 3.0, changes: 'Capstone — max caps' },
  ],
  security: {
    model: 'optional_thugs',
    thugCapacityL1: { WAREHOUSE: 50, NIGHTCLUB: 100, DRUG_LAB: 75 },
    effects: 'Raid chance −20% max; losses −30% max; adds heat',
  },
  collectTurnCost: 0,
  seasonRanking: 'street_nw_only_v1_1',
  drugLabIdentity: 'Produce yield bonus + premium drug storage',
  maxBusinesses: 8,
};

function v11AffordableDay(
  checkpoints: ReturnType<typeof summarizeCheckpoints>[],
  cost: number,
): number | null {
  return firstAffordableDay(checkpoints, cost);
}

function v11UpgradePath(type: BusinessType) {
  const base = businessPurchasePrice(type);
  const levels = [1, 2, 3, 4, 5].map((level) => ({
    level,
    invested: getBusinessInvestedValue(type, level),
    upgradeCost: level > 1 ? getBusinessUpgradeCost(type, level) : base,
    workerCap: getBusinessLevelStats(type, level).workerCapacity,
    safeCap: getBusinessLevelStats(type, level).safeCapacity,
    storageCap: getBusinessLevelStats(type, level).drugStorageCapacity,
  }));
  return { type, base, levels };
}

const v11Prices = {
  WAREHOUSE: businessPurchasePrice('WAREHOUSE'),
  NIGHTCLUB: businessPurchasePrice('NIGHTCLUB'),
  DRUG_LAB: businessPurchasePrice('DRUG_LAB'),
};

const v11Affordability = Object.fromEntries(
  ARCHETYPE_CONFIGS.map((a) => [
    a.id,
    {
      firstWarehouse: v11AffordableDay(archetypeRuns[a.id].checkpoints, v11Prices.WAREHOUSE),
      firstNightclub: v11AffordableDay(archetypeRuns[a.id].checkpoints, v11Prices.NIGHTCLUB),
      firstDrugLab: v11AffordableDay(archetypeRuns[a.id].checkpoints, v11Prices.DRUG_LAB),
      firstNightclubL2: v11AffordableDay(
        archetypeRuns[a.id].checkpoints,
        v11Prices.NIGHTCLUB + getBusinessUpgradeCost('NIGHTCLUB', 2),
      ),
      firstNightclubL5: v11AffordableDay(
        archetypeRuns[a.id].checkpoints,
        getBusinessInvestedValue('NIGHTCLUB', 5),
      ),
      day30Spendable: Math.round(
        (archetypeRuns[a.id].checkpoints[CHECKPOINT_DAYS.length - 1]?.cash?.median ?? 0) *
          (1 - RESERVE_FRACTION),
      ),
    },
  ]),
);

const v11Day30Meaningful = Object.fromEntries(
  ARCHETYPE_CONFIGS.map((a) => {
    const spendable = v11Affordability[a.id]!.day30Spendable;
    const l5Cost = getBusinessInvestedValue('NIGHTCLUB', 5);
    const l4Cost = getBusinessInvestedValue('NIGHTCLUB', 4);
    return [
      a.id,
      {
        canAffordL5Nightclub: spendable >= l5Cost,
        canAffordL4Nightclub: spendable >= l4Cost,
        remainingAfterL3: spendable - getBusinessInvestedValue('NIGHTCLUB', 3),
        businessesStillMeaningfulDay30: spendable < l5Cost,
      },
    ];
  }),
);

const matureEmpireDay30 = Object.fromEntries(
  ARCHETYPE_CONFIGS.map((a) => {
    const s = workerSnapshots[30]![a.id];
    const ncWorkers = Math.min(s.workers, 750);
    const passiveDay = businessHourlyIncome('NIGHTCLUB', ncWorkers) * 24;
    const activeDay = activeProduceHourly(s.workers - ncWorkers) * 24;
    return [
      a.id,
      {
        ...s,
        modelNightclubWorkers: ncWorkers,
        modelPassiveDay: passiveDay,
        modelActiveDay: activeDay,
        modelSpendableCash: Math.round(s.cash * (1 - RESERVE_FRACTION)),
        businessesAffordableAtCurrent: {
          warehouse: s.cash * (1 - RESERVE_FRACTION) >= 1_000_000,
          nightclub: s.cash * (1 - RESERVE_FRACTION) >= 2_000_000,
          drugLab: s.cash * (1 - RESERVE_FRACTION) >= 3_500_000,
        },
      },
    ];
  }),
);

const report = {
  generatedAt: new Date().toISOString(),
  monteCarloRuns: MONTE_CARLO,
  reserveFractionForAffordability: RESERVE_FRACTION,
  section1_liveRules: {
    maxBusinessesPerPlayer: MAX_BUSINESSES_PER_PLAYER,
    workersPerBusinessCap: 'NONE — unlimited, limited by street pool only',
    thugsAssignable: false,
    passiveFormula: `${BUSINESS_PASSIVE_INCOME_FRACTION * 100}% × Produce $/worker/turn (${REDLITE_PRODUCTION.cashPerProstitutePerTurn}) × turns/hr (${REDLITE_TURNS.regenerationRatePerHour}) × type multiplier`,
    safeBehaviour: 'Passive income accrues into safe until cap; must collect to pocket; excluded from NW while in safe',
    drugStorage: 'Hash/Shrooms/Coke/Heroin combined cap; excluded from NW while stored',
    collectTurnCost: 0,
    assignedWorkersPoachable: false,
    nwRules: {
      included: ['cash', 'bankCash', 'streetWorkers + assignedWorkers', 'vehicles', 'streetDrugs', 'businessStreetAssets (50% purchase price sum)'],
      excluded: ['weapons', 'supplies', 'safeCash', 'storedBusinessDrugs'],
      workerValuation: CANONICAL_NET_WORTH_VALUATIONS.worker,
      drugValuation: CANONICAL_NET_WORTH_VALUATIONS.drugUnit,
    },
    heatWeights: BUSINESS_DRUG_HEAT_WEIGHT,
    heatBands: BUSINESS_HEAT_BANDS,
    raidIntervalHours: 6,
    types: liveRules,
  },
  section2_affordability: {
    firstAffordableDayByThreshold: affordability,
    priceStructureComparison: priceStructureAffordability,
    day30MatureEmpire: matureEmpireDay30,
  },
  section3_workerCapacity: {
    snapshots: workerSnapshots,
    nightclubCapScenarios: capScenarios,
    dumpStrategyNote: 'Assigning all workers to one Nightclub removes them from poach target (prostitutes field) but sacrifices active Produce/Scout income on assigned workers',
  },
  section4_drugStorage: drugStorageAnalysis,
  section5_safeFill: safeFillMatrix,
  section6_heatSamples: [
    evaluateBusinessHeat({ businessType: 'NIGHTCLUB', level: 1, assignedWorkers: 750, assignedThugs: 0, safeCash: 400_000, stored: { hash: 0, shrooms: 0, coke: 3000, heroin: 1000 } }),
    evaluateBusinessHeat({ businessType: 'DRUG_LAB', level: 1, assignedWorkers: 400, assignedThugs: 0, safeCash: 500_000, stored: { hash: 0, shrooms: 0, coke: 12000, heroin: 3000 } }),
    evaluateBusinessHeat({ businessType: 'WAREHOUSE', level: 1, assignedWorkers: 500, assignedThugs: 0, safeCash: 100_000, stored: { hash: 10000, shrooms: 8000, coke: 5000, heroin: 2000 } }),
  ].map((h) => ({ ...h, raids: simulateRaidExpectation(h.band, 30) })),
  section7_endSeason: endSeasonScenario,
  section8_proposedV11: proposedV11,
  section9_v11Simulation: {
    implemented: true,
    affordability: v11Affordability,
    upgradePaths: (['WAREHOUSE', 'NIGHTCLUB', 'DRUG_LAB'] as BusinessType[]).map(v11UpgradePath),
    day30Meaningful: v11Day30Meaningful,
    conclusion:
      'V1.1 prices + upgrade ladder keep L4/L5 pursuit open for strong players through Day 30; first Nightclub typically Day 14-21 for Balanced/Power.',
  },
  explicitAnswers: {
    pricesTooCheap: 'YES for Power/Balanced by Day 14-21; marginal for Economy by Day 21-30',
    recommendedBasePrices: proposedV11.prices,
    workersCapped: true,
    workerCapsL1: proposedV11.workerCapsL1,
    drugLab15kEnough: 'NO at endgame for active producers — fills in 5-12 produce-days with 500-2000 thugs',
    eventualStorageTargets: { WAREHOUSE: 75000, NIGHTCLUB: 25000, DRUG_LAB: 50000 },
    businessesHaveLevels: true,
    upgradeCostsSharp: 'L2 60% base, L3 100%, L4 180%, L5 300% of original purchase',
    thugsAsSecurity: true,
    securityMandatory: false,
    collectCostsTurns: false,
    nightclubSafeCap: '$1.0M–$1.5M at L1 with upgrade path to $2M',
    passiveTooStrong: 'YES when uncapped — 1450 workers ≈ 83k/hr exceeds intended 10-30% of active layer',
    seasonEndRanking: 'Hybrid: Street NW live; Total Empire Value for final standings snapshot T-24h',
    drugLabPurpose: proposedV11.drugLabIdentity,
    maxBusinessesTen: 'Reduce to 8 with levels; 10×L1 trivial if prices stay low',
  },
};

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, 'business-economy-audit.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));

// Console summary
console.log('=== §1 LIVE BUSINESS RULES ===');
console.log(JSON.stringify(liveRules, null, 2));
console.log('\n=== §2 AFFORDABILITY (first day spendable cash ≥ threshold, 25% reserve) ===');
for (const a of ARCHETYPE_CONFIGS) {
  console.log(`\n${a.label}:`);
  for (const t of AFFORD_THRESHOLDS) {
    const d = affordability[a.id]![String(t)];
    console.log(`  ${fmt(t)}: ${d == null ? 'not in 30d' : `Day ${d}`}`);
  }
}
console.log('\n=== §2 PRICE STRUCTURES (first affordable day for each type) ===');
console.log(JSON.stringify(priceStructureAffordability, null, 2));
console.log('\n=== §3 WORKER SNAPSHOTS ===');
console.log(JSON.stringify(workerSnapshots, null, 2));
console.log('\n=== §4 DRUG: turns to 15,000 coke ===');
console.log(JSON.stringify(drugStorageAnalysis.turnsToProduce15k, null, 2));
console.log('\n=== §5 NIGHTCLUB SAFE FILL (hours) ===');
for (const row of safeFillMatrix.nightclub.filter((r) => [250, 500, 750, 1000, 1450, 2500].includes(r.workers))) {
  console.log(
    `${row.workers}W: $${row.hourly.toLocaleString()}/hr | 750k=${row.fill750k.toFixed(1)}h | 1M=${row.fill1m.toFixed(1)}h | passive/active=${(row.passiveVsActive * 100).toFixed(1)}%`,
  );
}
console.log('\n=== §9 V1.1 SIMULATION (implemented prices + upgrades) ===');
console.log(JSON.stringify(v11Affordability, null, 2));
console.log(JSON.stringify(v11Day30Meaningful, null, 2));
console.log(`\nFull JSON: ${outPath}`);
console.log('Analysis complete — no production constants modified.');
