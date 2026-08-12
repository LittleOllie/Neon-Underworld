/**
 * Reports PlayerTurnState backfill outcome for canonical turn rules.
 * Run after: npx prisma migrate deploy
 *
 * Usage: npx tsx scripts/backfill-canonical-turn-state.ts
 */
import { PrismaClient } from '@prisma/client';
import { TURNS_CONFIG } from '../src/config/game/balance';
import { REDLITE_TURNS } from '../src/config/game/redlite-rules';

const prisma = new PrismaClient();

const CANONICAL_CAP = TURNS_CONFIG.turnCap;
const CANONICAL_RATE = TURNS_CONFIG.regenerationRatePerMs;
const PREVIOUS_CAP = 12000;
const PREVIOUS_RATE = 0.013888888888888888;

async function main() {
  const rows = await prisma.playerTurnState.findMany({
    select: {
      id: true,
      playerId: true,
      currentTurns: true,
      turnCap: true,
      regenerationRate: true,
    },
  });

  let wouldClamp = 0;
  let stillNonCanonical = 0;
  const clampedSamples: { playerId: string; before: number; after: number }[] = [];

  for (const row of rows) {
    const needsClamp = row.currentTurns > CANONICAL_CAP;
    if (needsClamp) {
      wouldClamp++;
      if (clampedSamples.length < 10) {
        clampedSamples.push({
          playerId: row.playerId,
          before: row.currentTurns,
          after: CANONICAL_CAP,
        });
      }
    }
    const capOk = row.turnCap === CANONICAL_CAP;
    const rateOk = Math.abs(row.regenerationRate - CANONICAL_RATE) < 1e-15;
    const turnsOk = row.currentTurns <= CANONICAL_CAP;
    if (!capOk || !rateOk || !turnsOk) stillNonCanonical++;
  }

  const report = {
    recordsInspected: rows.length,
    recordsStillNonCanonical: stillNonCanonical,
    balancesClampedInMigration: wouldClamp,
    clampedSamples,
    previousConfiguration: {
      turnCap: PREVIOUS_CAP,
      regenerationRatePerMs: PREVIOUS_RATE,
      note: 'Init migration defaults before Redlite alignment',
    },
    finalConfiguration: {
      turnsPerInterval: REDLITE_TURNS.turnsPerInterval,
      intervalMinutes: REDLITE_TURNS.intervalMinutes,
      turnCap: CANONICAL_CAP,
      startingTurns: TURNS_CONFIG.startingTurns,
      regenerationRatePerMs: CANONICAL_RATE,
      regenerationRatePerHour: TURNS_CONFIG.regenerationRatePerHour,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
