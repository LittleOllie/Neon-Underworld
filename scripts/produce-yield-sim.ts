/**
 * Produce yield + cap analysis — run: npx tsx scripts/produce-yield-sim.ts
 */
import {
  DRUG_PRODUCTION_RATES,
  expectedDrugUnits,
  getDrugProductionRate,
  turnsToReachDrugUnits,
} from '../src/config/game/drug-production-rates';
import { planSupplyConsumption } from '../src/config/game/supply-economy';
import { getDrugStreetPrice } from '../src/config/game/drug-street-prices';
import { getCityShopItem } from '../src/config/game/shop-rules';
import { happinessEfficiencyModifier } from '../src/lib/game-engine/happiness';
import {
  estimateDrugUnitsProduced,
  estimateHashProduceNet,
  estimateSplitDrugUnitsProduced,
} from '../src/lib/game-engine/produce-economy';
import { grossWorkerCash, playerCashFromGross } from '../src/lib/game-engine/worker-economics';
import { PRODUCTION_CONFIG } from '../src/config/game/balance';
import type { ProductionDrug } from '../src/lib/game-engine/production';

const DRUGS: ProductionDrug[] = ['hash', 'shrooms', 'coke', 'heroin'];
const DISTRICTS = ['neon-strip', 'docklands', 'old-quarter'] as const;
const THUG_COUNTS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
const TURN_SPENDS = [50, 100, 500, 1000, 5000];
const MORALE_LEVELS = [
  { label: '100%', score: 100 },
  { label: '80%', score: 80 },
  { label: '50%', score: 50 },
];
const HEALTHY = 85;
const WORKERS = 500;

const hashShop = getCityShopItem('hash')!;
const condomShop = getCityShopItem('condom')!;
const beerShop = getCityShopItem('beer')!;

console.log('=== DRUG PRODUCTION RATES (per thug per turn, before variance) ===');
for (const drug of DRUGS) {
  console.log(`${drug.padEnd(8)} ${getDrugProductionRate(drug)}`);
}
console.log('Per-action hard cap: NONE\n');

console.log('=== Turns to reach 2,000 units (old cap reference) ===');
console.log('Thugs | Morale | Hash | Shrooms | Coke | Heroin');
for (const thugs of THUG_COUNTS) {
  for (const morale of MORALE_LEVELS) {
    const eff = happinessEfficiencyModifier(morale.score);
    const cols = DRUGS.map((d) => {
      const t = turnsToReachDrugUnits(thugs, d, 2000, eff);
      return t == null ? '—' : String(t);
    });
    console.log(
      `${String(thugs).padStart(5)} | ${morale.label.padEnd(6)} | ${cols.map((c) => c.padStart(5)).join(' | ')}`,
    );
  }
}
console.log('');

function splitPatterns(total: number): number[][] {
  if (total === 1000) return [[1000], [500, 500], [250, 250, 250, 250], Array(10).fill(100), Array(20).fill(50)];
  if (total === 5000) return [[5000], [1000, 1000, 1000, 1000, 1000], Array(10).fill(500), Array(20).fill(250), Array(50).fill(100)];
  return [[total]];
}

console.log('=== SPLIT INVARIANCE (500 thugs, healthy morale, hash rate) ===');
for (const total of [1000, 5000]) {
  console.log(`\nTotal ${total} turns:`);
  console.log('Pattern        | Units | Supply hash | Worker cash');
  for (const chunks of splitPatterns(total)) {
    const units = estimateSplitDrugUnitsProduced({
      turnChunks: chunks,
      thugCount: 500,
      drugType: 'hash',
      thugHappiness: HEALTHY,
    });
    let supplyHash = 0;
    for (const t of chunks) {
      const p = planSupplyConsumption(WORKERS, 500, t, {
        condoms: 99999,
        hash: 99999,
        beer: 99999,
      });
      supplyHash += p.required.hash ?? 0;
    }
    const cash = chunks.reduce(
      (sum, t) =>
        sum +
        Math.floor(
          playerCashFromGross(
            grossWorkerCash(WORKERS, t, PRODUCTION_CONFIG.cashPerProstitutePerTurn),
            50,
          ) * happinessEfficiencyModifier(HEALTHY),
        ),
      0,
    );
    const label =
      chunks.length === 1
        ? `1×${total}`
        : `${chunks.length}×${chunks[0]}`;
    console.log(
      `${label.padEnd(14)} | ${String(units).padStart(5)} | ${String(supplyHash).padStart(11)} | $${cash.toLocaleString()}`,
    );
  }
}

console.log('\n=== PRODUCTION BY DRUG (500 thugs, healthy morale) ===');
console.log('Turns | Hash | Shrooms | Coke | Heroin');
for (const turns of TURN_SPENDS) {
  const cols = DRUGS.map((d) =>
    String(estimateDrugUnitsProduced({ turnsSpent: turns, thugCount: 500, drugType: d, thugHappiness: HEALTHY })),
  );
  console.log(`${String(turns).padStart(5)} | ${cols.map((c) => c.padStart(7)).join(' | ')}`);
}

console.log('\n=== STREET VALUE BY CITY (500 thugs, 100 turns) ===');
console.log('City          | Hash    | Shrooms | Coke     | Heroin');
for (const district of DISTRICTS) {
  const vals = DRUGS.map((d) => {
    const units = estimateDrugUnitsProduced({
      turnsSpent: 100,
      thugCount: 500,
      drugType: d,
      thugHappiness: HEALTHY,
    });
    return units * getDrugStreetPrice(district, d);
  });
  console.log(
    `${district.padEnd(13)} | ${vals.map((v) => ('$' + v.toLocaleString()).padStart(7)).join(' | ')}`,
  );
}

console.log('\n=== HASH NET (500W/500T, balanced) ===');
for (const turns of [100, 500, 1000, 5000]) {
  const { hashProduced, hashConsumed, netHash } = estimateHashProduceNet({
    prostitutes: 500,
    thugs: 500,
    turnsSpent: turns,
    thugHappiness: HEALTHY,
  });
  console.log(
    `${turns} turns: produced ${hashProduced}, consumed ${hashConsumed}, net ${netHash >= 0 ? '+' : ''}${netHash}`,
  );
}

console.log('\n(Hash production exempts worker hash upkeep — net equals produced units.)');

console.log('\n=== SUPPLY REPLACEMENT (500W/500T, 100 turns) ===');
const plan = planSupplyConsumption(500, 500, 100, { condoms: 99999, hash: 99999, beer: 99999 });
const replace =
  (plan.required.condoms ?? 0) * condomShop.shopPrice +
  (plan.required.hash ?? 0) * hashShop.shopPrice +
  (plan.required.beer ?? 0) * beerShop.shopPrice;
console.log(`Condoms/hash/beer each: ${plan.required.hash}; replacement cost: $${replace.toLocaleString()}`);

console.log('\n=== ECONOMIC DOMINANCE CHECK (100 turns, 500 thugs, best city per drug) ===');
for (const drug of DRUGS) {
  const units = estimateDrugUnitsProduced({ turnsSpent: 100, thugCount: 500, drugType: drug, thugHappiness: HEALTHY });
  const best = Math.max(...DISTRICTS.map((d) => units * getDrugStreetPrice(d, drug)));
  console.log(`${drug.padEnd(8)} best street $${best.toLocaleString()}`);
}
