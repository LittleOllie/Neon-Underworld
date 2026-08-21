/**
 * Local development NPC population (~40 attackable operators).
 *
 *   npm run seed:npcs              # idempotent — creates missing fixtures
 *   npm run seed:npcs -- --reset   # wipe local-npc fixtures, then reseed
 *   npm run seed:npcs -- --refresh # re-apply asset state to existing fixtures
 *
 * Requires an active season (run npm run db:seed first).
 * Refuses production / Vercel unless ALLOW_DEV_SEED=true.
 */
import { PrismaClient } from '@prisma/client';
import { assertDevSeedAllowed } from './lib/dev-guard';
import {
  formatLocalNpcSeedReport,
  LOCAL_NPC_COUNT,
  seedLocalNpcs,
} from './lib/local-npc-seed';

async function main() {
  assertDevSeedAllowed('seed-local-npcs');

  const reset = process.argv.includes('--reset');
  const refresh = process.argv.includes('--refresh') || reset;

  const prisma = new PrismaClient();
  try {
    console.log(`Seeding ${LOCAL_NPC_COUNT} local NPC fixtures${reset ? ' (reset)' : ''}...`);
    const report = await seedLocalNpcs(prisma, { reset, refreshExisting: refresh });
    console.log(formatLocalNpcSeedReport(report));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
