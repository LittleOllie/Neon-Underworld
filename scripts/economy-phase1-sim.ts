/**
 * Economy Phase 1 simulation — run: npx tsx scripts/economy-phase1-sim.ts
 */
import { planSupplyConsumption } from '../src/config/game/supply-economy';
import { getDrugStreetPrice, validateStreetDrugPricing } from '../src/config/game/drug-street-prices';
import { getCityShopItem } from '../src/config/game/shop-rules';
import { payoutMoraleScore } from '../src/lib/game-engine/payout-morale';
import { grossWorkerCash, playerCashFromGross } from '../src/lib/game-engine/worker-economics';
import { happinessEfficiencyModifier } from '../src/lib/game-engine/happiness';
import { SCOUTING_CONFIG, PRODUCTION_CONFIG } from '../src/config/game/balance';

const CREW_SIZES = [50, 100, 250, 500, 1000, 2500];
const TURN_SPENDS = [50, 100, 500, 1000];
const PAYOUTS = [1, 25, 50, 75, 100];
const DISTRICTS = ['neon-strip', 'docklands', 'old-quarter'] as const;

console.log('=== Supply consumption (150 crew-turns per unit) ===\n');
console.log('Crew | Turns | Condoms+Hash | Beer');
for (const crew of [100, 500, 2500]) {
  for (const turns of [100, 1000]) {
    const plan = planSupplyConsumption(crew, crew, turns, {
      condoms: 99999,
      hash: 99999,
      beer: 99999,
    });
    console.log(
      `${String(crew).padStart(4)} | ${String(turns).padStart(5)} | ${String(plan.required.condoms ?? 0).padStart(12)} | ${String(plan.required.beer ?? 0).padStart(4)}`,
    );
  }
}

console.log('\n=== Payout vs morale vs retained cash (300 workers, 100 turns scout) ===');
console.log('Payout | Morale slot | Retained $ (80% crew morale)');
for (const payout of PAYOUTS) {
  const morale = Math.round(payoutMoraleScore(payout) * 100);
  const gross = grossWorkerCash(300, 100, SCOUTING_CONFIG.cashPerProstitutePerTurn);
  const retained = Math.floor(
    playerCashFromGross(gross, payout) * happinessEfficiencyModifier(80),
  );
  console.log(`${String(payout).padStart(5)}% | ${String(morale).padStart(11)} | $${retained.toLocaleString()}`);
}

console.log('\n=== Street drug prices by city ===');
console.log('District      | Hash | Shrooms | Coke | Heroin');
for (const d of DISTRICTS) {
  console.log(
    `${d.padEnd(13)} | ${String(getDrugStreetPrice(d, 'hash')).padStart(4)} | ${String(getDrugStreetPrice(d, 'shrooms')).padStart(7)} | ${String(getDrugStreetPrice(d, 'coke')).padStart(4)} | ${String(getDrugStreetPrice(d, 'heroin')).padStart(6)}`,
  );
}

console.log('\n=== Arbitrage check (shop buy → street sell same city) ===');
let arbitrageOk = true;
for (const d of DISTRICTS) {
  for (const drug of ['hash', 'shrooms', 'coke', 'heroin'] as const) {
    const shopKey = drug === 'shrooms' ? 'shroom' : drug;
    const shop = getCityShopItem(shopKey);
    const street = getDrugStreetPrice(d, drug);
    if (shop && street >= shop.shopPrice) {
      console.log(`FAIL ${d}/${drug}: street $${street} >= shop $${shop.shopPrice}`);
      arbitrageOk = false;
    }
  }
}
console.log(arbitrageOk ? 'PASS — no same-city shop→street profit' : 'FAIL');

const pricing = validateStreetDrugPricing();
console.log(pricing.valid ? 'Street pricing validation PASS' : pricing.violations.join(', '));

console.log('\n=== Active player 7-day sketch (500 workers/thugs, 70% turn use) ===');
const dailyTurns = 576;
const activeUse = Math.floor(dailyTurns * 0.7 * 7);
const supplyPlan = planSupplyConsumption(500, 500, activeUse, { condoms: 5000, hash: 5000, beer: 5000 });
const scoutGross = grossWorkerCash(500, activeUse, SCOUTING_CONFIG.cashPerProstitutePerTurn);
const scoutRetained = Math.floor(playerCashFromGross(scoutGross, 50) * happinessEfficiencyModifier(75));
const produceGross = grossWorkerCash(500, activeUse, PRODUCTION_CONFIG.cashPerProstitutePerTurn);
console.log(`Turns used (7d active): ${activeUse.toLocaleString()}`);
console.log(`Supply units needed: condoms/hash ${supplyPlan.required.condoms}, beer ${supplyPlan.required.beer}`);
console.log(`Scout retained cash (all scout): ~$${scoutRetained.toLocaleString()}`);
console.log(`Produce worker cash (if all produce): ~$${Math.floor(playerCashFromGross(produceGross, 50) * happinessEfficiencyModifier(75)).toLocaleString()}`);
