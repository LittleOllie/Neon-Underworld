/**
 * Produce / supply economy simulation — run: npx tsx scripts/produce-economy-sim.ts
 */
import { getDrugProductionRate } from '../src/config/game/drug-production-rates';
import { planSupplyConsumption } from '../src/config/game/supply-economy';
import { getDrugStreetPrice } from '../src/config/game/drug-street-prices';
import { getCityShopItem } from '../src/config/game/shop-rules';
import {
  estimateDrugUnitsProduced,
  estimateHashProduceNet,
  hashProduceBreakEvenThugRatio,
} from '../src/lib/game-engine/produce-economy';
import { grossWorkerCash, playerCashFromGross } from '../src/lib/game-engine/worker-economics';
import { happinessEfficiencyModifier } from '../src/lib/game-engine/happiness';
import { PRODUCTION_CONFIG } from '../src/config/game/balance';
import type { ProductionDrug } from '../src/lib/game-engine/production';

const CREW_PROFILES = [
  { label: '100W/100T', workers: 100, thugs: 100 },
  { label: '500W/500T', workers: 500, thugs: 500 },
  { label: '1000W/1000T', workers: 1000, thugs: 1000 },
  { label: '2000W/500T', workers: 2000, thugs: 500 },
  { label: '500W/2000T', workers: 500, thugs: 2000 },
] as const;

const TURN_SPENDS = [10, 50, 100, 250, 500, 1000] as const;
const DRUGS: ProductionDrug[] = ['hash', 'shrooms', 'coke', 'heroin'];
const DISTRICTS = ['neon-strip', 'docklands', 'old-quarter'] as const;
const HEALTHY_MORALE = 85;

const hashShop = getCityShopItem('hash')!;
const condomShop = getCityShopItem('condom')!;
const beerShop = getCityShopItem('beer')!;

console.log('=== Authoritative constants ===');
for (const drug of DRUGS) {
  console.log(`${drug} rate: ${getDrugProductionRate(drug)}`);
}
console.log('Per-action cap: NONE');

console.log('=== Hash net when PRODUCING HASH (healthy morale, expected avg RNG) ===');
console.log('Crew          | Turns |  Produced | Consumed | Net Hash');
for (const crew of CREW_PROFILES) {
  for (const turns of TURN_SPENDS) {
    const { hashProduced, hashConsumed, netHash } = estimateHashProduceNet({
      prostitutes: crew.workers,
      thugs: crew.thugs,
      turnsSpent: turns,
      thugHappiness: HEALTHY_MORALE,
    });
    const sign = netHash >= 0 ? '+' : '';
    console.log(
      `${crew.label.padEnd(13)} | ${String(turns).padStart(5)} | ${String(hashProduced).padStart(9)} | ${String(hashConsumed).padStart(8)} | ${sign}${netHash}`,
    );
  }
  console.log('');
}

console.log('=== Gross hash production by crew ===');
console.log('Crew          | Turns | Units produced');
for (const crew of CREW_PROFILES) {
  for (const turns of [10, 50, 100, 500, 1000]) {
    const units = estimateDrugUnitsProduced({
      turnsSpent: turns,
      thugCount: crew.thugs,
      drugType: 'hash',
      thugHappiness: HEALTHY_MORALE,
    });
    console.log(`${crew.label.padEnd(13)} | ${String(turns).padStart(5)} | ${units}`);
  }
  console.log('');
}

console.log('=== Supply cost per produce run (500W/500T) ===');
console.log('Turns | Condoms | Hash | Beer | Replace $');
for (const turns of TURN_SPENDS) {
  const plan = planSupplyConsumption(500, 500, turns, {
    condoms: 99999,
    hash: 99999,
    beer: 99999,
  });
  const c = plan.required.condoms ?? 0;
  const h = plan.required.hash ?? 0;
  const b = plan.required.beer ?? 0;
  const replaceCost = c * condomShop.shopPrice + h * hashShop.shopPrice + b * beerShop.shopPrice;
  console.log(
    `${String(turns).padStart(5)} | ${String(c).padStart(7)} | ${String(h).padStart(4)} | ${String(b).padStart(4)} | $${replaceCost.toLocaleString()}`,
  );
}

console.log('\n=== Economic output (500W/500T, 100 turns, payout 50%, healthy morale) ===');
const turns = 100;
const workers = 500;
const thugs = 500;
const gross = grossWorkerCash(workers, turns, PRODUCTION_CONFIG.cashPerProstitutePerTurn);
const workerEff = happinessEfficiencyModifier(HEALTHY_MORALE);
const cashEarned = Math.floor(playerCashFromGross(gross, 50) * workerEff);
const plan = planSupplyConsumption(workers, thugs, turns, {
  condoms: 99999,
  hash: 99999,
  beer: 99999,
});
const supplyReplace =
  (plan.required.condoms ?? 0) * condomShop.shopPrice +
  (plan.required.hash ?? 0) * hashShop.shopPrice +
  (plan.required.beer ?? 0) * beerShop.shopPrice;

console.log('Drug     | Units | Street $ (best city) | Street $ (worst) | NW @$5');
for (const drug of DRUGS) {
  const units = estimateDrugUnitsProduced({
    turnsSpent: turns,
    thugCount: thugs,
    drugType: drug,
    thugHappiness: HEALTHY_MORALE,
  });
  const prices = DISTRICTS.map((d) => getDrugStreetPrice(d, drug));
  const best = Math.max(...prices);
  const worst = Math.min(...prices);
  console.log(
    `${drug.padEnd(8)} | ${String(units).padStart(5)} | ${String('$' + (best * units).toLocaleString()).padStart(19)} | ${String('$' + (worst * units).toLocaleString()).padStart(16)} | $${(units * 5).toLocaleString()}`,
  );
}
console.log(`Worker cash (player share): $${cashEarned.toLocaleString()}`);
console.log(`Supply replacement cost:    $${supplyReplace.toLocaleString()}`);

console.log('\n=== Split vs single action (500W/500T, 1000 turns total) ===');
const splits = [
  { label: '1 × 1000', runs: [{ turns: 1000 }] },
  { label: '2 × 500', runs: [{ turns: 500 }, { turns: 500 }] },
  { label: '4 × 250', runs: [{ turns: 250 }, { turns: 250 }, { turns: 250 }, { turns: 250 }] },
  { label: '10 × 100', runs: Array.from({ length: 10 }, () => ({ turns: 100 })) },
];
console.log('Split        | Drug units | Hash consumed | Condoms consumed');
for (const split of splits) {
  let units = 0;
  let hashUsed = 0;
  let condomsUsed = 0;
  for (const run of split.runs) {
    units += estimateDrugUnitsProduced({
      turnsSpent: run.turns,
      thugCount: thugs,
      drugType: 'hash',
      thugHappiness: HEALTHY_MORALE,
    });
    const p = planSupplyConsumption(workers, thugs, run.turns, {
      condoms: 99999,
      hash: 99999,
      beer: 99999,
    });
    hashUsed += p.required.hash ?? 0;
    condomsUsed += p.required.condoms ?? 0;
  }
  console.log(
    `${split.label.padEnd(12)} | ${String(units).padStart(10)} | ${String(hashUsed).padStart(13)} | ${String(condomsUsed).padStart(16)}`,
  );
}
