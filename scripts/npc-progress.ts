#!/usr/bin/env npx tsx
/**
 * Force NPC dynamic progression for the active season.
 *
 *   npm run npc:progress
 *   npm run npc:progress -- --hours=24
 *   npm run npc:progress -- --day=7 --force
 *   npm run npc:progress -- --include-local
 */
import { PrismaClient } from '@prisma/client';
import { progressDueNpcs } from '../src/server/services/npc-progression.service';

function parseArgs() {
  const args = process.argv.slice(2);
  let forceDay: number | undefined;
  let simulateElapsedHours: number | undefined;
  let force = false;
  let includeLocalNpcs: boolean | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--day' && args[i + 1]) {
      forceDay = parseInt(args[i + 1]!, 10);
      i++;
    } else if (arg.startsWith('--day=')) {
      forceDay = parseInt(arg.split('=')[1]!, 10);
    } else if (arg === '--hours' && args[i + 1]) {
      simulateElapsedHours = parseFloat(args[i + 1]!);
      i++;
    } else if (arg.startsWith('--hours=')) {
      simulateElapsedHours = parseFloat(arg.split('=')[1]!);
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--include-local') {
      includeLocalNpcs = true;
    } else if (arg === '--no-local') {
      includeLocalNpcs = false;
    }
  }

  return { forceDay, simulateElapsedHours, force, includeLocalNpcs };
}

async function main() {
  const { forceDay, simulateElapsedHours, force, includeLocalNpcs } = parseArgs();
  const prisma = new PrismaClient();
  try {
    const result = await progressDueNpcs(prisma, {
      forceDay,
      force,
      simulateElapsedHours,
      includeLocalNpcs,
    });
    if (!result) {
      console.error('No active season found.');
      process.exit(1);
    }
    const hoursNote =
      simulateElapsedHours != null ? ` (simulated ${simulateElapsedHours}h elapsed)` : '';
    console.log(
      `NPC progression complete — day ${result.roundDay}${hoursNote}: ${result.processed} processed, ${result.skipped} skipped, ${result.errors} errors.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
