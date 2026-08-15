#!/usr/bin/env npx tsx
/** Post-implementation 30-day sim — production formulas + thug shop hiring. */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DISTRICTS, STARTING_RESOURCES, TURNS_CONFIG } from '../src/config/game/balance';
import { THUG_HIRE_PRICE } from '../src/config/game/hire-thugs-rules';
import { calculateEmpireRecruitmentMultipliers } from '../src/config/game/empire-recruitment-rules';
import { resolveScouting } from '../src/lib/game-engine/scouting';
import { resolveProduction } from '../src/lib/game-engine/production';
import {
  businessHourlyIncome,
  businessPurchasePrice,
  getBusinessLevelStats,
  getBusinessUpgradeCost,
} from '../src/config/game/business-rules';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';

const OUT = join(process.cwd(), 'scripts/output/crew-scale-implementation-sim.json');
const TPD = Math.floor(TURNS_CONFIG.regenerationRatePerMs * 86400000);
const CHECKPOINTS = [1, 3, 7, 10, 15, 21, 30] as const;
const neon = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;
type Biz = { businessType: 'WAREHOUSE' | 'NIGHTCLUB' | 'DRUG_LAB'; level: number };

type Arch = {
  id: string;
  activity: number;
  scoutShare: number;
  produceShare: number;
  biz: 'none' | 'mixed' | 'worker' | 'thug';
  workerArea: 'clubs' | 'docks';
  thugBuyFraction: number;
  reserve: number;
};

const ARCH: Arch[] = [
  { id: 'casual', activity: 0.32, scoutShare: 0.5, produceShare: 0.48, biz: 'none', workerArea: 'clubs', thugBuyFraction: 0, reserve: 0.35 },
  { id: 'regular', activity: 0.68, scoutShare: 0.5, produceShare: 0.47, biz: 'mixed', workerArea: 'clubs', thugBuyFraction: 0.05, reserve: 0.25 },
  { id: 'active', activity: 0.9, scoutShare: 0.5, produceShare: 0.47, biz: 'mixed', workerArea: 'clubs', thugBuyFraction: 0.08, reserve: 0.2 },
  { id: 'business-focused', activity: 0.85, scoutShare: 0.65, produceShare: 0.32, biz: 'worker', workerArea: 'clubs', thugBuyFraction: 0.02, reserve: 0.15 },
  { id: 'pvp-focused', activity: 0.8, scoutShare: 0.45, produceShare: 0.5, biz: 'thug', workerArea: 'docks', thugBuyFraction: 0.35, reserve: 0.2 },
  { id: 'extreme-scout', activity: 0.98, scoutShare: 0.92, produceShare: 0.07, biz: 'none', workerArea: 'clubs', thugBuyFraction: 0, reserve: 0.4 },
  { id: 'wealthy-military', activity: 0.75, scoutShare: 0.3, produceShare: 0.4, biz: 'thug', workerArea: 'docks', thugBuyFraction: 0.55, reserve: 0.1 },
  { id: 'recruitment-specialist', activity: 0.97, scoutShare: 0.58, produceShare: 0.38, biz: 'worker', workerArea: 'clubs', thugBuyFraction: 0.03, reserve: 0.1 },
];

function tryBusinessInvest(cash: number, businesses: Biz[], priority: Arch['biz'], reserve: number) {
  let spendable = cash - cash * reserve;
  const pick = (): Biz['businessType'] | null => {
    if (priority === 'none' || businesses.length >= 8) return null;
    const c = { WAREHOUSE: 0, NIGHTCLUB: 0, DRUG_LAB: 0 };
    for (const b of businesses) c[b.businessType]++;
    if (priority === 'worker') {
      if (!c.WAREHOUSE) return 'WAREHOUSE';
      if (!c.NIGHTCLUB) return 'NIGHTCLUB';
      return c.WAREHOUSE <= c.NIGHTCLUB ? 'WAREHOUSE' : 'NIGHTCLUB';
    }
    if (priority === 'thug') {
      if (!c.DRUG_LAB) return 'DRUG_LAB';
      if (!c.NIGHTCLUB) return 'NIGHTCLUB';
      return 'DRUG_LAB';
    }
    if (!c.NIGHTCLUB) return 'NIGHTCLUB';
    if (!c.WAREHOUSE) return 'WAREHOUSE';
    if (!c.DRUG_LAB) return 'DRUG_LAB';
    return 'NIGHTCLUB';
  };
  while (true) {
    const type = pick();
    if (!type) break;
    const price = businessPurchasePrice(type);
    if (spendable < price) break;
    spendable -= price;
    cash -= price;
    businesses.push({ businessType: type, level: 1 });
  }
  for (const b of businesses) {
    while (b.level < 5) {
      const cost = getBusinessUpgradeCost(b.businessType, b.level + 1);
      if (spendable < cost) break;
      spendable -= cost;
      cash -= cost;
      b.level++;
    }
  }
  return cash;
}

function run(arch: Arch, seed: number) {
  let turns = TURNS_CONFIG.startingTurns;
  let workers = STARTING_RESOURCES.prostitutes;
  let thugs = STARTING_RESOURCES.thugs;
  let purchasedThugs = 0;
  let cash = STARTING_RESOURCES.cash;
  let coke = 0;
  const businesses: Biz[] = [];
  let seedCursor = seed;
  const snaps: Record<number, object> = {};

  for (let day = 1; day <= 30; day++) {
    turns = Math.min(TURNS_CONFIG.turnCap, turns + TPD);
    const spend = Math.floor(turns * arch.activity);
    const scoutT = Math.floor(spend * arch.scoutShare);
    const prodT = spend - scoutT;

    const recruitment = calculateEmpireRecruitmentMultipliers({
      businesses,
      workers,
      thugs,
      assignedWorkers: Math.min(workers, calculateEmpireRecruitmentMultipliers({ businesses, workers, thugs, assignedWorkers: 0 }).totalWorkerCapacity),
    });

    if (scoutT > 0 && turns >= scoutT) {
      const out = resolveScouting({
        turnsSpent: scoutT,
        districtModifiers: neon,
        areaSlug: arch.workerArea,
        prostituteHappiness: 82,
        thugHappiness: 82,
        prostituteCount: workers,
        thugCount: thugs,
        prostitutePayoutPercent: 50,
        seed: seedCursor++,
        businessNetwork: {
          workerMultiplier: recruitment.workerMultiplier,
          thugMultiplier: recruitment.thugMultiplier,
          workerBonusPercent: recruitment.workerBonusPercent,
          thugBonusPercent: recruitment.thugBonusPercent,
        },
      });
      workers = Math.max(0, workers + out.prostitutesFound - out.prostitutesLost);
      thugs = Math.max(0, thugs + out.thugsFound - out.thugsLost);
      cash += out.cashEarned;
      turns -= scoutT;
    }
    if (prodT > 0 && thugs > 0 && turns >= prodT) {
      const out = resolveProduction({
        turnsSpent: prodT,
        thugCount: thugs,
        prostituteCount: workers,
        prostituteHappiness: 82,
        thugHappiness: 82,
        prostitutePayoutPercent: 50,
        drugType: 'coke',
        seed: seedCursor++,
      });
      workers = Math.max(0, workers - out.prostitutesLost);
      thugs = Math.max(0, thugs - out.thugsLost);
      cash += out.cashEarned;
      coke += out.drugUnitsProduced;
      turns -= prodT;
    }

    cash = tryBusinessInvest(cash, businesses, arch.biz, arch.reserve);

    const postRec = calculateEmpireRecruitmentMultipliers({
      businesses,
      workers,
      thugs,
      assignedWorkers: Math.min(workers, calculateEmpireRecruitmentMultipliers({ businesses, workers, thugs, assignedWorkers: 0 }).totalWorkerCapacity),
    });
    const assigned = Math.min(workers, postRec.totalWorkerCapacity);
    let remaining = assigned;
    for (const b of businesses) {
      const cap = getBusinessLevelStats(b.businessType, b.level).workerCapacity;
      const assign = Math.min(cap, remaining);
      remaining -= assign;
      cash += businessHourlyIncome(b.businessType, assign, b.level) * 24 * 0.35;
    }

    if (arch.thugBuyFraction > 0) {
      const spendable = cash * (1 - arch.reserve);
      const budget = Math.floor(spendable * arch.thugBuyFraction);
      const hire = Math.floor(budget / THUG_HIRE_PRICE);
      if (hire > 0) {
        cash -= hire * THUG_HIRE_PRICE;
        thugs += hire;
        purchasedThugs += hire;
      }
    }

    if ((CHECKPOINTS as readonly number[]).includes(day)) {
      const rec = calculateEmpireRecruitmentMultipliers({
        businesses,
        workers,
        thugs,
        assignedWorkers: assigned,
      });
      snaps[day] = {
        day,
        workers,
        scoutedThugs: thugs - purchasedThugs - STARTING_RESOURCES.thugs,
        purchasedThugs,
        totalThugs: thugs,
        cash: Math.round(cash),
        netWorth: calculateCanonicalNetWorthFromPlayer({
          cash,
          bankCash: 0,
          thugs,
          prostitutes: workers,
          rides: 0,
          hash: 0,
          shrooms: 0,
          coke,
          heroin: 0,
        }),
        businesses: businesses.map((b) => `${b.businessType.slice(0, 3)} L${b.level}`),
        workerBonus: rec.workerBonusPercent,
        thugBonus: rec.thugBonusPercent,
        recruitmentMult: Math.round(rec.workerMultiplier * 100) / 100,
        empireFactor: rec.empireFactor,
        strength: rec.strengthLabel,
      };
    }
  }
  return snaps;
}

const progression = Object.fromEntries(ARCH.map((a, i) => [a.id, run(a, 9000 + i * 100)]));
mkdirSync(join(process.cwd(), 'scripts/output'), { recursive: true });
console.log('Implementation sim Day 30:');
for (const a of ARCH) {
  const d = progression[a.id][30] as { workers: number; totalThugs: number; purchasedThugs: number; scoutedThugs: number; netWorth: number };
  console.log(`  ${a.id}: ${d.workers}W / ${d.totalThugs}T (${d.scoutedThugs} scouted + ${d.purchasedThugs} hired) NW $${(d.netWorth / 1e6).toFixed(1)}M`);
}

/** Scout yield expectations by empire phase (median over seeds). */
const SCOUT_PHASES = [
  { id: 'fresh', label: 'Fresh', businesses: [] as Biz[], workers: 5, thugs: 3, assigned: 0 },
  { id: 'mid', label: 'Mid', businesses: [{ businessType: 'WAREHOUSE' as const, level: 3 }, { businessType: 'NIGHTCLUB' as const, level: 2 }], workers: 800, thugs: 450, assigned: 600 },
  { id: 'established', label: 'Established', businesses: [{ businessType: 'WAREHOUSE' as const, level: 5 }, { businessType: 'NIGHTCLUB' as const, level: 4 }, { businessType: 'DRUG_LAB' as const, level: 3 }], workers: 3500, thugs: 2200, assigned: 2800 },
  { id: 'elite', label: 'Elite', businesses: Array.from({ length: 6 }, () => ({ businessType: 'WAREHOUSE' as const, level: 5 })), workers: 12000, thugs: 8000, assigned: 9000 },
];
const TURN_AMOUNTS = [25, 50, 100, 250, 500, 1000];
const scoutExpectations: Record<string, Record<number, { workers: number; thugs: number; mult: number }>> = {};
for (const phase of SCOUT_PHASES) {
  const rec = calculateEmpireRecruitmentMultipliers({
    businesses: phase.businesses,
    workers: phase.workers,
    thugs: phase.thugs,
    assignedWorkers: phase.assigned,
  });
  scoutExpectations[phase.id] = {};
  for (const turns of TURN_AMOUNTS) {
    let wSum = 0;
    let tSum = 0;
    const trials = 200;
    for (let s = 0; s < trials; s++) {
      const out = resolveScouting({
        turnsSpent: turns,
        districtModifiers: neon,
        areaSlug: 'clubs',
        prostituteHappiness: 82,
        thugHappiness: 82,
        prostituteCount: phase.workers,
        thugCount: phase.thugs,
        prostitutePayoutPercent: 50,
        seed: 50000 + s * 17 + turns,
        businessNetwork: {
          workerMultiplier: rec.workerMultiplier,
          thugMultiplier: rec.thugMultiplier,
          workerBonusPercent: rec.workerBonusPercent,
          thugBonusPercent: rec.thugBonusPercent,
        },
      });
      wSum += out.prostitutesFound;
      tSum += out.thugsFound;
    }
    scoutExpectations[phase.id][turns] = {
      workers: Math.round(wSum / trials),
      thugs: Math.round(tSum / trials),
      mult: Math.round(rec.workerMultiplier * 100) / 100,
    };
  }
}
writeFileSync(
  OUT,
  JSON.stringify({ generatedAt: new Date().toISOString(), progression, scoutExpectations }, null, 2),
);
console.log('\nScout expectations (25 turns, clubs):');
for (const phase of SCOUT_PHASES) {
  const e = scoutExpectations[phase.id][25];
  console.log(`  ${phase.label}: ~${e.workers}W / ~${e.thugs}T (×${e.mult})`);
}
