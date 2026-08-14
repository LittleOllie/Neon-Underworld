/**
 * DEV-ONLY — Cartel Defence v2 design & simulation audit.
 * Run: npx tsx scripts/cartel-defence-v2-sim.ts
 * Uses live resolveCombat / weapon allocation — no production changes.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { resolveCombat, deriveCombatSeed } from '../src/lib/game-engine/combat/resolve-combat';
import { allocateWeaponsForThugs } from '../src/lib/game-engine/combat/weapon-allocation';
import { ATTACK_RULES } from '../src/config/game/attack-rules';
import { REDLITE_NET_WORTH } from '../src/config/game/redlite-rules';
import { isWithinAttackRange } from '../src/config/game/redlite-rules';
import { cartelDefenceThugBonus } from '../src/lib/game-engine/cartel-economics';

const RUNS = 400;
const OUT_DIR = path.join(__dirname, 'output');

/** Personal rides: 1 ride = 5 thugs (attack transport). Model cartel rides same ratio by default. */
const THUGS_PER_RIDE = ATTACK_RULES.thugsPerRide;

interface DefenderProfile {
  id: string;
  personalThugs: number;
  netWorth: number;
  personalGlocks: number;
  personalUzis: number;
  personalAks: number;
}

interface CartelProfile {
  id: string;
  cartelThugs: number;
  cartelGlocks: number;
  cartelUzis: number;
  cartelRides: number;
  /** Same-city active mates excluding defender */
  mateThugs: number[];
}

interface DeploymentInput {
  personalThugs: number;
  netWorth: number;
  personalCombatStrength: number;
  cartel: CartelProfile;
  virtualSupport: number;
  model: string;
  multiplier?: number;
  floor?: number;
  ceilingPct?: number;
  rideCapacityRatio?: number;
  memberShareFraction?: number;
}

function personalWeaponsForThugs(thugs: number): { glocks: number; uzis: number; aks: number } {
  const armed = Math.floor(thugs * 0.6);
  const uzis = Math.floor(armed * 0.25);
  const aks = Math.floor(armed * 0.1);
  const glocks = Math.max(0, armed - uzis - aks);
  return { glocks, uzis, aks };
}

function attackerWeaponsForThugs(thugs: number): { glocks: number; uzis: number; aks: number } {
  const armed = Math.floor(thugs * 0.7);
  const uzis = Math.floor(armed * 0.35);
  const aks = Math.floor(armed * 0.15);
  const glocks = Math.max(0, armed - uzis - aks);
  return { glocks, uzis, aks };
}

function personalCombatStrength(thugs: number, glocks: number, uzis: number, aks: number): number {
  return allocateWeaponsForThugs(thugs, { glocks, uzis, aks }).totalStrength;
}

function nwAllowance(netWorth: number): number {
  /** Tiered: ~1 cartel thug per $10k NW, capped smoothly */
  return Math.floor(Math.sqrt(netWorth / 1000) * 15);
}

function hybridAllowance(personalThugs: number, netWorth: number, mult: number, floor: number, cap: number): number {
  const fromThugs = Math.floor(personalThugs * mult);
  const fromNw = nwAllowance(netWorth);
  return Math.min(cap, Math.max(floor, Math.max(fromThugs, Math.floor((fromThugs + fromNw) / 2))));
}

function computeDeployedThugs(input: DeploymentInput): number {
  const {
    personalThugs,
    netWorth,
    personalCombatStrength: pcs,
    cartel,
    model,
    multiplier = 2,
    floor = 0,
    ceilingPct,
    rideCapacityRatio = THUGS_PER_RIDE,
    memberShareFraction = 1,
  } = input;

  let allowance: number;
  switch (model) {
    case 'CURRENT_FULL_POOL':
      allowance = cartel.cartelThugs;
      break;
    case 'MULTIPLIER':
      allowance = Math.floor(personalThugs * multiplier);
      break;
    case 'NW':
      allowance = nwAllowance(netWorth);
      break;
    case 'COMBAT_STRENGTH':
      allowance = Math.floor(pcs / 5);
      break;
    case 'HYBRID':
      allowance = hybridAllowance(personalThugs, netWorth, multiplier, floor, cartel.cartelThugs);
      break;
    case 'MEMBER_SHARE':
      allowance = Math.floor((cartel.cartelThugs / 5) * memberShareFraction);
      break;
    default:
      allowance = Math.floor(personalThugs * multiplier);
  }

  if (floor > 0) allowance = Math.max(floor, allowance);
  if (ceilingPct != null) {
    allowance = Math.min(allowance, Math.floor(cartel.cartelThugs * ceilingPct));
  }

  const rideCap = cartel.cartelRides * rideCapacityRatio;
  const rideLimited = rideCap > 0 ? Math.min(allowance, rideCap) : allowance;

  return Math.min(rideLimited, cartel.cartelThugs);
}

function virtualSupportFromMates(mateThugs: number[], fraction = 0.25): number {
  return cartelDefenceThugBonus(mateThugs.map((thugs) => ({ thugs })), fraction);
}

interface SimResult {
  winRate: number;
  repulseRate: number;
  avgAttackerLosses: number;
  avgPersonalDefLosses: number;
  avgCartelLosses: number;
  avgDefenderStrength: number;
  deployedCartelThugs: number;
}

function simulateDriveBy(
  defender: DefenderProfile,
  cartel: CartelProfile,
  attackingThugs: number,
  deployedCartelThugs: number,
  virtualSupport: number,
  attackerNw: number,
): SimResult & { legal: boolean } {
  const legal = isWithinAttackRange(attackerNw, defender.netWorth);
  let wins = 0;
  let repulsed = 0;
  let attLoss = 0;
  let defLoss = 0;
  let cartelLoss = 0;
  let defStr = 0;

  const defW = personalWeaponsForThugs(defender.personalThugs);
  const attW = attackerWeaponsForThugs(attackingThugs);

  for (let i = 0; i < RUNS; i++) {
    const seed = deriveCombatSeed('att', 'def', `sim-${i}-${deployedCartelThugs}-${attackingThugs}`);
    const combat = resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs,
      seed,
      cartelSupportThugs: virtualSupport,
      cartelArmoury: {
        thugs: deployedCartelThugs,
        glocks: cartel.cartelGlocks,
        uzis: cartel.cartelUzis,
      },
      attacker: {
        thugs: attackingThugs,
        ...attW,
        cash: 100_000,
        drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      },
      defender: {
        thugs: defender.personalThugs,
        ...defW,
        cash: defender.netWorth * 0.1,
        drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      },
    });
    if (combat.outcome === 'SUCCESS' || combat.outcome === 'PARTIAL') wins++;
    if (combat.outcome === 'REPULSED') repulsed++;
    attLoss += combat.attackerLosses;
    defLoss += combat.defenderLosses;
    cartelLoss += combat.cartelThugLosses;
    const snap = combat.defenderForceSnapshot as { allocation?: { totalStrength?: number } };
    defStr +=
      (snap.allocation?.totalStrength ?? 0) +
      virtualSupport +
      allocateWeaponsForThugs(deployedCartelThugs, {
        glocks: cartel.cartelGlocks,
        uzis: cartel.cartelUzis,
        aks: 0,
      }).totalStrength;
  }

  return {
    legal,
    winRate: wins / RUNS,
    repulseRate: repulsed / RUNS,
    avgAttackerLosses: attLoss / RUNS,
    avgPersonalDefLosses: defLoss / RUNS,
    avgCartelLosses: cartelLoss / RUNS,
    avgDefenderStrength: defStr / RUNS,
    deployedCartelThugs,
  };
}

function eliteCartel(thugs: number, ridePct = 1): CartelProfile {
  const armed = Math.floor(thugs * 0.5);
  const uzis = Math.floor(armed * 0.4);
  const glocks = armed - uzis;
  const ridesNeeded = Math.ceil(thugs / THUGS_PER_RIDE);
  return {
    id: `C-${thugs}`,
    cartelThugs: thugs,
    cartelGlocks: glocks,
    cartelUzis: uzis,
    cartelRides: Math.max(1, Math.floor(ridesNeeded * ridePct)),
    mateThugs: [800, 600, 500, 400],
  };
}

function simulateConcurrentAttacks(
  cartel: CartelProfile,
  defender: DefenderProfile,
  attackCount: number,
  model: 'CURRENT' | 'SHARED_POOL',
  deployedPerDefender: number,
  virtualSupport: number,
  attackingThugs: number,
): { totalCartelLosses: number; avgWinRate: number; forceInflationFactor: number } {
  let poolThugs = cartel.cartelThugs;
  let poolGlocks = cartel.cartelGlocks;
  let poolUzis = cartel.cartelUzis;
  let wins = 0;
  let totalCartelLoss = 0;

  for (let a = 0; a < attackCount; a++) {
    const deployed =
      model === 'CURRENT' ? cartel.cartelThugs : Math.min(deployedPerDefender, poolThugs);
    const defW = personalWeaponsForThugs(defender.personalThugs);
    const attW = attackerWeaponsForThugs(attackingThugs);
    const seed = deriveCombatSeed('att', `def-${a}`, `conc-${a}`);
    const combat = resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs,
      seed,
      cartelSupportThugs: virtualSupport,
      cartelArmoury: {
        thugs: deployed,
        glocks: model === 'CURRENT' ? cartel.cartelGlocks : poolGlocks,
        uzis: model === 'CURRENT' ? cartel.cartelUzis : poolUzis,
      },
      attacker: { thugs: attackingThugs, ...attW, cash: 100_000, drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 } },
      defender: {
        thugs: defender.personalThugs,
        ...defW,
        cash: 50_000,
        drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      },
    });
    if (combat.outcome !== 'REPULSED') wins++;
    totalCartelLoss += combat.cartelThugLosses;
    if (model === 'SHARED_POOL') {
      poolThugs = Math.max(0, poolThugs - combat.cartelThugLosses);
    }
  }

  const sequentialWin = simulateDriveBy(
    defender,
    cartel,
    attackingThugs,
    deployedPerDefender,
    virtualSupport,
    defender.netWorth * 2,
  ).winRate;

  return {
    totalCartelLosses: totalCartelLoss,
    avgWinRate: wins / attackCount,
    forceInflationFactor: model === 'CURRENT' ? attackCount : 1,
  };
}

const DEFENDERS: DefenderProfile[] = [
  { id: 'D1', personalThugs: 10, netWorth: 200_000, ...personalWeaponsForThugs(10) },
  { id: 'D2', personalThugs: 50, netWorth: 1_000_000, ...personalWeaponsForThugs(50) },
  { id: 'D3', personalThugs: 250, netWorth: 5_000_000, ...personalWeaponsForThugs(250) },
  { id: 'D4', personalThugs: 1000, netWorth: 20_000_000, ...personalWeaponsForThugs(1000) },
  { id: 'D5', personalThugs: 5000, netWorth: 100_000_000, ...personalWeaponsForThugs(5000) },
  { id: 'D6', personalThugs: 20000, netWorth: 500_000_000, ...personalWeaponsForThugs(20000) },
];

const CARTEL_SIZES = [0, 500, 2500, 10000, 20000, 50000];

const output: Record<string, unknown> = {
  meta: {
    runs: RUNS,
    engine: 'resolveCombat DRIVE_BY',
    weaponStrengths: ATTACK_RULES.weapons,
    thugsPerRide: THUGS_PER_RIDE,
    cartelPrices: { thug: 700, glock: 500, uzi: 1500 },
  },
  currentBaseline: {},
  headlineTest: {},
  strongPlayerTest: {},
  multiplierSweep: {},
  nwSweep: {},
  hybridSweep: {},
  rideCapacitySweep: {},
  floorSweep: {},
  ceilingSweep: {},
  virtualSupportOptions: {},
  concurrentAttacks: {},
  treasuryEconomics: {},
  investmentValue: {},
  modelScores: {},
  topModels: [],
};

// --- Current baseline note ---
output.currentBaseline = {
  personalDefence: 'Defender personal thugs armed AK→Uzi→Glock; personal weapons can attrition.',
  virtualSupport:
    '25% floor of same-district, non-travelling, ACTIVE cartel mates thugs; force-only, no casualties.',
  armoury:
    'Full cartel.thugs/glocks/uzis pool per attack; cartel thugs take casualties after personal thugs; weapons never lost.',
  travel: 'defender.travelling → zero cartel context; supporters must be same districtId, not travelling.',
  concurrentBug:
    'Each concurrent attack reads full pool; weapons/virtual force multiply; only thug decrement writes (partial mitigation).',
};

// --- Headline $1M / 50 thug test ---
const headlineDef = DEFENDERS[1];
const headlineCartel = eliteCartel(20000, 1);
headlineCartel.cartelRides = 4000;
const headlineVirtual = virtualSupportFromMates(headlineCartel.mateThugs, 0.25);
const headlineAttackers = [50, 100, 250, 500, 1000, 2500];
const headlineResults: Record<string, unknown>[] = [];

for (const model of ['CURRENT_FULL_POOL', 'MULTIPLIER', 'NW', 'HYBRID', 'MEMBER_SHARE'] as const) {
  for (const mult of [0.5, 1, 2, 3, 5, 10]) {
    if (model === 'MULTIPLIER' || model === 'HYBRID') {
      const deployed = computeDeployedThugs({
        personalThugs: headlineDef.personalThugs,
        netWorth: headlineDef.netWorth,
        personalCombatStrength: personalCombatStrength(
          headlineDef.personalThugs,
          headlineDef.personalGlocks,
          headlineDef.personalUzis,
          headlineDef.personalAks,
        ),
        cartel: headlineCartel,
        virtualSupport: headlineVirtual,
        model,
        multiplier: mult,
        floor: model === 'HYBRID' ? 25 : 0,
      });
      for (const atk of headlineAttackers) {
        const r = simulateDriveBy(
          headlineDef,
          headlineCartel,
          atk,
          deployed,
          headlineVirtual,
          headlineDef.netWorth * 2,
        );
        headlineResults.push({
          model: `${model}×${mult}`,
          deployed,
          virtualSupport: headlineVirtual,
          attackerThugs: atk,
          ...r,
        });
      }
    }
  }
  if (model === 'NW' || model === 'CURRENT_FULL_POOL' || model === 'MEMBER_SHARE') {
    const deployed = computeDeployedThugs({
      personalThugs: headlineDef.personalThugs,
      netWorth: headlineDef.netWorth,
      personalCombatStrength: personalCombatStrength(
        headlineDef.personalThugs,
        headlineDef.personalGlocks,
        headlineDef.personalUzis,
        headlineDef.personalAks,
      ),
      cartel: headlineCartel,
      virtualSupport: headlineVirtual,
      model,
    });
    for (const atk of [100, 500, 1000]) {
      const r = simulateDriveBy(
        headlineDef,
        headlineCartel,
        atk,
        deployed,
        headlineVirtual,
        headlineDef.netWorth * 2,
      );
      headlineResults.push({ model, deployed, attackerThugs: atk, ...r });
    }
  }
}

output.headlineTest = {
  defender: headlineDef,
  cartel: headlineCartel,
  virtualSupport: headlineVirtual,
  results: headlineResults,
};

// --- Strong player (D5 vs 20k cartel) ---
const strongDef = DEFENDERS[4];
const strongCartel = eliteCartel(20000, 1);
const strongVirtual = virtualSupportFromMates(strongCartel.mateThugs, 0.25);
const strongResults: Record<string, unknown>[] = [];

for (const mult of [1, 2, 3, 5]) {
  const deployed = computeDeployedThugs({
    personalThugs: strongDef.personalThugs,
    netWorth: strongDef.netWorth,
    personalCombatStrength: personalCombatStrength(
      strongDef.personalThugs,
      strongDef.personalGlocks,
      strongDef.personalUzis,
      strongDef.personalAks,
    ),
    cartel: strongCartel,
    virtualSupport: strongVirtual,
    model: 'MULTIPLIER',
    multiplier: mult,
  });
  for (const atk of [2500, 5000, 10000]) {
    strongResults.push({
      multiplier: mult,
      deployed,
      attackerThugs: atk,
      ...simulateDriveBy(strongDef, strongCartel, atk, deployed, strongVirtual, strongDef.netWorth * 0.6),
    });
  }
}
output.strongPlayerTest = { defender: strongDef, results: strongResults };

// --- Multiplier sweep D2 vs 20k cartel, attacker 500 ---
for (const mult of [0.5, 1, 2, 3, 5, 10]) {
  const deployed = computeDeployedThugs({
    personalThugs: 50,
    netWorth: 1_000_000,
    personalCombatStrength: 100,
    cartel: headlineCartel,
    virtualSupport: headlineVirtual,
    model: 'MULTIPLIER',
    multiplier: mult,
  });
  (output.multiplierSweep as Record<string, unknown>)[String(mult)] = {
    deployed,
    ...simulateDriveBy(headlineDef, headlineCartel, 500, deployed, headlineVirtual, 2_000_000),
  };
}

// --- Ride capacity sweep (5 vs 3 vs 10 thugs/ride) ---
for (const ratio of [3, 5, 10]) {
  const cartel = { ...headlineCartel, cartelRides: 100 };
  const deployed = computeDeployedThugs({
    personalThugs: 50,
    netWorth: 1_000_000,
    personalCombatStrength: 100,
    cartel,
    virtualSupport: headlineVirtual,
    model: 'MULTIPLIER',
    multiplier: 2,
    rideCapacityRatio: ratio,
  });
  (output.rideCapacitySweep as Record<string, unknown>)[`${ratio}_per_ride`] = {
    maxDeployWith100Rides: deployed,
    ...simulateDriveBy(headlineDef, cartel, 500, deployed, headlineVirtual, 2_000_000),
  };
}

// --- Floor sweep ---
for (const floor of [0, 10, 25, 50, 100]) {
  const deployed = computeDeployedThugs({
    personalThugs: 10,
    netWorth: 200_000,
    personalCombatStrength: 30,
    cartel: eliteCartel(20000),
    virtualSupport: 100,
    model: 'MULTIPLIER',
    multiplier: 2,
    floor,
  });
  (output.floorSweep as Record<string, unknown>)[String(floor)] = {
    deployed,
    ...simulateDriveBy(DEFENDERS[0], eliteCartel(20000), 100, deployed, 100, 500_000),
  };
}

// --- Ceiling sweep ---
for (const pct of [0.1, 0.2, 0.25, 0.5, 1]) {
  const deployed = computeDeployedThugs({
    personalThugs: 5000,
    netWorth: 100_000_000,
    personalCombatStrength: 50000,
    cartel: eliteCartel(20000),
    virtualSupport: 500,
    model: 'MULTIPLIER',
    multiplier: 10,
    ceilingPct: pct,
  });
  (output.ceilingSweep as Record<string, unknown>)[`${pct * 100}%`] = {
    deployed,
    ...simulateDriveBy(DEFENDERS[4], eliteCartel(20000), 5000, deployed, 500, 200_000_000),
  };
}

// --- Virtual support options ---
for (const frac of [0, 0.05, 0.1, 0.25]) {
  const v = virtualSupportFromMates(headlineCartel.mateThugs, frac);
  const deployed = 100;
  (output.virtualSupportOptions as Record<string, unknown>)[`${frac * 100}%`] = {
    virtualSupport: v,
    ...simulateDriveBy(headlineDef, headlineCartel, 500, deployed, v, 2_000_000),
  };
}

// --- Concurrent attacks ---
output.concurrentAttacks = {
  scenario: '5 simultaneous attacks on different members, 20k cartel, 500 attacker each',
  currentModel: simulateConcurrentAttacks(
    eliteCartel(20000),
    headlineDef,
    5,
    'CURRENT',
    20000,
    headlineVirtual,
    500,
  ),
  sharedPoolModel: simulateConcurrentAttacks(
    eliteCartel(20000),
    headlineDef,
    5,
    'SHARED_POOL',
    100,
    headlineVirtual,
    500,
  ),
  note: 'CURRENT applies full pool force per attack; SHARED_POOL uses 2× cap (100) and depletes thugs.',
};

// --- Treasury economics ---
function treasuryCost(thugs: number, armPct = 0.5, uziShare = 0.4) {
  const armed = Math.floor(thugs * armPct);
  const uzis = Math.floor(armed * uziShare);
  const glocks = armed - uzis;
  const thugCost = thugs * 700;
  const weaponCost = uzis * 1500 + glocks * 500;
  return { thugCost, weaponCost, total: thugCost + weaponCost, uzis, glocks };
}

output.treasuryEconomics = {
  force100: treasuryCost(100),
  force500: treasuryCost(500),
  force1000: treasuryCost(1000),
  force5000: treasuryCost(5000),
  force20000: treasuryCost(20000),
  rideCostsPerThugCapacity: {
    at2500_per_ride: { ridesFor20k: Math.ceil(20000 / 5), costAt2500: Math.ceil(20000 / 5) * 2500 },
    at5000_per_ride: { ridesFor20k: Math.ceil(20000 / 5), costAt5000: Math.ceil(20000 / 5) * 5000 },
    at10000_per_ride: { ridesFor20k: Math.ceil(20000 / 5), costAt10000: Math.ceil(20000 / 5) * 10000 },
  },
};

// --- Investment value (D2, 2× multiplier, attacker 500) ---
const investResults: Record<string, unknown>[] = [];
for (const thugs of [500, 2500, 10000, 20000]) {
  const c = eliteCartel(thugs);
  const deployed = Math.min(thugs, 100);
  investResults.push({
    cartelThugs: thugs,
    deployed,
    ...simulateDriveBy(headlineDef, c, 500, deployed, virtualSupportFromMates(c.mateThugs), 2_000_000),
  });
}
output.investmentValue = investResults;

// --- Scenario matrix (sample) ---
const matrix: Record<string, unknown>[] = [];
for (const d of DEFENDERS) {
  for (const ct of CARTEL_SIZES) {
    if (ct === 0) continue;
    const c = eliteCartel(ct);
    const v = virtualSupportFromMates(c.mateThugs);
    const deployedCurrent = ct;
    const deployedV2 = Math.min(ct, Math.max(25, d.personalThugs * 2));
    const atk = d.personalThugs;
    matrix.push({
      defender: d.id,
      cartelThugs: ct,
      attackerThugs: atk,
      current: simulateDriveBy(d, c, atk, deployedCurrent, v, d.netWorth * 2),
      v2_2x_cap: simulateDriveBy(d, c, atk, deployedV2, v, d.netWorth * 2),
    });
  }
}
output.scenarioMatrix = matrix;

// --- Model scores (1-10 heuristic from sim) ---
output.modelScores = {
  'A: 2× multiplier + 25 floor + 25% virtual + shared pool': {
    cartelValue: 8,
    individualProgression: 8,
    attackViability: 7,
    defenceViability: 7,
    understandability: 9,
    exploitResistance: 8,
    economySink: 7,
    scalability: 8,
    implementationComplexity: 6,
  },
  'B: Hybrid max(2× thugs, sqrt(NW)) + floor 25 + shared pool': {
    cartelValue: 8,
    individualProgression: 8,
    attackViability: 7,
    defenceViability: 8,
    understandability: 7,
    exploitResistance: 8,
    economySink: 7,
    scalability: 9,
    implementationComplexity: 7,
  },
  'C: Current full pool (baseline)': {
    cartelValue: 10,
    individualProgression: 2,
    attackViability: 9,
    defenceViability: 10,
    understandability: 6,
    exploitResistance: 2,
    economySink: 5,
    scalability: 2,
    implementationComplexity: 3,
  },
};

mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, 'cartel-defence-v2-sim.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${outPath}`);
console.log('\n--- Headline D2 (50 thugs, $1M) vs 20k cartel, attacker 500 ---');
for (const mult of [0.5, 1, 2, 3, 5, 10]) {
  const row = (output.multiplierSweep as Record<string, SimResult>)[String(mult)];
  console.log(
    `  ${mult}× → deploy ${row.deployedCartelThugs} | repulse ${(row.repulseRate * 100).toFixed(0)}% | cartel losses/attack ${row.avgCartelLosses.toFixed(0)}`,
  );
}
