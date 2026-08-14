/**
 * READ-ONLY fresh-player walkthrough simulation — dev audit helper.
 * Run: npx tsx scripts/fresh-player-walkthrough-sim.ts
 */
import { resolveScouting } from '../src/lib/game-engine/scouting';
import { resolveProduction } from '../src/lib/game-engine/production';
import { resolveSupplyConsumptionForAction } from '../src/lib/game-engine/supply-consumption';
import { estimateProducePreview } from '../src/lib/game-engine/produce-economy';
import { DISTRICTS, STARTING_RESOURCES, TURNS_CONFIG } from '../src/config/game/balance';
import { calculateProstituteHappiness, calculateThugHappiness } from '../src/lib/game-engine/happiness';
import { REDLITE_NET_WORTH } from '../src/config/game/redlite-rules';

function nw(c: number, w: number, t: number, h: number) {
  return c + w * REDLITE_NET_WORTH.prostitutes + t * REDLITE_NET_WORTH.thugs + h * REDLITE_NET_WORTH.hash;
}

let workers = STARTING_RESOURCES.prostitutes;
let thugs = STARTING_RESOURCES.thugs;
let cash = STARTING_RESOURCES.cash;
let turns = TURNS_CONFIG.startingTurns;
let condoms = STARTING_RESOURCES.condoms;
let hash = STARTING_RESOURCES.hash;
let beer = STARTING_RESOURCES.beer;
let seed = 42;
const district = DISTRICTS.find((d) => d.slug === 'neon-strip')!;

console.log('=== FRESH ACCOUNT START ===');
console.log(JSON.stringify({
  cash,
  turns,
  turnCap: TURNS_CONFIG.turnCap,
  workers,
  thugs,
  glocks: STARTING_RESOURCES.glocks,
  rides: STARTING_RESOURCES.rides,
  beer,
  condoms,
  hash,
  drugs: { shrooms: 0, coke: 0, heroin: 0 },
  nw: nw(cash, workers, thugs, hash),
}, null, 2));

function scout(amount: number, area: 'streets' | 'clubs' = 'streets') {
  const supply = resolveSupplyConsumptionForAction({
    prostitutes: workers,
    thugs,
    turnsSpent: amount,
    condoms,
    hash,
    beer,
  });
  const wHappy = calculateProstituteHappiness({
    prostitutes: workers,
    thugs,
    hash: supply.inventoryAfter.hash,
    condoms: supply.inventoryAfter.condoms,
    prostitutePayoutPercent: 50,
  }).score;
  const tHappy = calculateThugHappiness({
    thugs,
    glocks: 1,
    uzis: 0,
    aks: 0,
    beer: supply.inventoryAfter.beer,
  }).score;
  const before = nw(cash, workers, thugs, hash);
  const r = resolveScouting({
    turnsSpent: amount,
    districtModifiers: district.modifiers,
    districtSlug: 'neon-strip',
    areaSlug: area,
    prostituteHappiness: wHappy,
    thugHappiness: tHappy,
    prostituteCount: workers,
    thugCount: thugs,
    prostitutePayoutPercent: 50,
    seed: seed++,
  });
  condoms = supply.inventoryAfter.condoms;
  hash = supply.inventoryAfter.hash;
  beer = supply.inventoryAfter.beer;
  workers += r.prostitutesFound - r.prostitutesLost;
  thugs += r.thugsFound - r.thugsLost;
  cash += r.cashEarned;
  turns -= amount;
  const after = nw(cash, workers, thugs, hash);
  console.log(`Scout ${amount} (${area}): +${r.prostitutesFound}W +${r.thugsFound}T cash=$${r.cashEarned} supplies=${JSON.stringify(supply.plan.consumed)} NW+${after - before} turns=${turns} crew=${workers}W/${thugs}T`);
}

console.log('\n=== NATURAL FIRST-DAY SCOUT LOOP ===');
scout(25);
scout(25);
scout(50);

console.log('\n=== FIRST PRODUCE (25 turns hash) ===');
{
  const amount = 25;
  const supply = resolveSupplyConsumptionForAction({
    prostitutes: workers,
    thugs,
    turnsSpent: amount,
    condoms,
    hash,
    beer,
    exemptWorkerHash: true,
  });
  const preview = estimateProducePreview({
    turnsSpent: amount,
    thugCount: thugs,
    prostituteCount: workers,
    drugType: 'hash',
    thugHappiness: 80,
    workerHappiness: 75,
  });
  const wHappy = calculateProstituteHappiness({
    prostitutes: workers,
    thugs,
    hash: supply.inventoryAfter.hash,
    condoms: supply.inventoryAfter.condoms,
    prostitutePayoutPercent: 50,
    exemptHashMorale: true,
  }).score;
  const tHappy = calculateThugHappiness({ thugs, glocks: 1, uzis: 0, aks: 0, beer: supply.inventoryAfter.beer }).score;
  const r = resolveProduction({
    turnsSpent: amount,
    thugCount: thugs,
    prostituteCount: workers,
    prostituteHappiness: wHappy,
    thugHappiness: tHappy,
    prostitutePayoutPercent: 50,
    drugType: 'hash',
    seed: seed++,
  });
  condoms = supply.inventoryAfter.condoms;
  beer = supply.inventoryAfter.beer;
  hash += r.drugUnitsProduced;
  cash += r.cashEarned;
  turns -= amount;
  console.log(`Preview: ${preview.drugMin}-${preview.drugMax} hash, ~$${preview.playerCash}`);
  console.log(`Result: +${r.drugUnitsProduced} hash, $${r.cashEarned}, hash consumed=${supply.plan.consumed.hash ?? 0}, turns=${turns}`);
}

console.log('\n=== END OF REALISTIC SESSION ===');
console.log(JSON.stringify({
  turns,
  cash,
  workers,
  thugs,
  condoms,
  hash,
  beer,
  nw: nw(cash, workers, thugs, hash),
}, null, 2));

console.log('\nCore actions before exhausting 500 (theoretical max at 25/turn):', Math.floor(500 / 25));
