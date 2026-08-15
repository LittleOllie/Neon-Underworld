#!/usr/bin/env npx tsx
/**
 * Force NPC ladder progression for the active season.
 *
 *   npm run npc:progress
 *   npm run npc:progress -- --day 7
 *   npm run npc:progress -- --day 30 --force
 */
import { PrismaClient } from '@prisma/client';
import { progressActiveSeasonNpcs } from '../src/server/services/npc-progression.service';

function parseArgs() {
  const args = process.argv.slice(2);
  let forceDay: number | undefined;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--day' && args[i + 1]) {
      forceDay = parseInt(args[i + 1]!, 10);
      i++;
    } else if (args[i] === '--force') {
      force = true;
    }
  }
  return { forceDay, force };
}

async function main() {
  const { forceDay, force } = parseArgs();
  const prisma = new PrismaClient();
  try {
    const result = await progressActiveSeasonNpcs(prisma, { forceDay, force });
    if (!result) {
      console.error('No active season found.');
      process.exit(1);
    }
    console.log(
      `NPC progression complete — day ${result.roundDay}: ${result.processed} processed, ${result.skipped} skipped, ${result.errors} errors.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
