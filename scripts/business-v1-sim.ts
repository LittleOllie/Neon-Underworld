/**
 * Business V1 economy simulation — dev tuning reference.
 * Run: npx tsx scripts/business-v1-sim.ts
 */

import {
  businessHourlyIncome,
  businessHourlyIncomePerWorker,
  getBusinessTypeRule,
} from '../src/config/game/business-rules';
import { evaluateBusinessHeat } from '../src/lib/game-engine/business/heat';
import { BUSINESS_RAID_CHANCE_PER_CHECK } from '../src/config/game/business-rules';

const WORKER_COUNTS = [50, 250, 500, 1000];
const TYPES = ['WAREHOUSE', 'NIGHTCLUB', 'DRUG_LAB'] as const;

console.log('=== PASSIVE INCOME (per worker / hr) ===');
for (const type of TYPES) {
  console.log(`${type}: $${businessHourlyIncomePerWorker(type).toFixed(2)}/worker/hr`);
}

console.log('\n=== HOURLY INCOME BY WORKERS ===');
for (const type of TYPES) {
  console.log(`\n${type}`);
  for (const w of WORKER_COUNTS) {
    const hr = businessHourlyIncome(type, w);
    console.log(`  ${w} workers: $${hr.toLocaleString()}/hr · $${(hr * 24).toLocaleString()}/day`);
  }
}

console.log('\n=== BREAK-EVEN (passive only, ignoring raids) ===');
for (const type of TYPES) {
  const price = getBusinessTypeRule(type).purchasePrice;
  console.log(`\n${type} ($${price.toLocaleString()})`);
  for (const w of WORKER_COUNTS) {
    const daily = businessHourlyIncome(type, w) * 24;
    const days = daily > 0 ? (price / daily).toFixed(1) : '∞';
    console.log(`  ${w} workers: ~${days} days to break even on purchase`);
  }
}

console.log('\n=== HEAT SAMPLES ===');
const samples = [
  { label: 'Empty warehouse', type: 'WAREHOUSE' as const, w: 50, safe: 0, drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 } },
  { label: 'Loaded drug lab', type: 'DRUG_LAB' as const, w: 500, safe: 450_000, drugs: { hash: 0, shrooms: 0, coke: 8000, heroin: 4000 } },
  { label: 'Full nightclub safe', type: 'NIGHTCLUB' as const, w: 300, safe: 750_000, drugs: { hash: 2000, shrooms: 500, coke: 1000, heroin: 200 } },
];
for (const s of samples) {
  const heat = evaluateBusinessHeat({
    businessType: s.type,
    assignedWorkers: s.w,
    safeCash: s.safe,
    stored: s.drugs,
  });
  const dailyRaid = BUSINESS_RAID_CHANCE_PER_CHECK[heat.band] * 4;
  console.log(`${s.label}: ${heat.label} (${heat.score}) · ~${(dailyRaid * 100).toFixed(2)}% raid/day`);
}

console.log('\n=== ACTIVE VS PASSIVE (Nightclub, 500 workers) ===');
const activePerHr = 12 * 24 * 500;
const passivePerHr = businessHourlyIncome('NIGHTCLUB', 500);
console.log(`Active produce gross: $${activePerHr.toLocaleString()}/hr (100% payout, no morale)`);
console.log(`Business passive: $${passivePerHr.toLocaleString()}/hr (${((passivePerHr / activePerHr) * 100).toFixed(1)}% of active)`);
