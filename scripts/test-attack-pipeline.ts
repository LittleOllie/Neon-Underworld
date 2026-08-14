/**
 * Local full attack pipeline test (admin vs seeded defender).
 * Usage: npx tsx scripts/test-attack-pipeline.ts
 */
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { resolveAttackEncounter } from '../src/server/services/combat.service';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { toUserMessage } from '../src/lib/game-engine/gameplay-errors';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase() },
    include: { player: true },
  });
  if (!admin?.player) throw new Error('Run db:seed first');

  const report = await prisma.report.findFirst({
    where: {
      playerId: admin.player.id,
      metadata: { path: ['type'], equals: 'PLAYER_INTEL' },
    },
  });
  if (!report) {
    console.log('No intel — run: npx tsx scripts/e2e-combat-setup.ts');
    process.exit(1);
  }

  try {
    const result = await resolveAttackEncounter(
      admin.player.id,
      admin.id,
      { kind: 'intel', scoutReportId: report.id },
      'HOME_INVASION',
      10,
      uuidv4(),
      (p) => calculateCanonicalNetWorthFromPlayer(p as never),
    );
    console.log('resolve OK', result.outcome);
  } catch (error) {
    console.error('resolve FAIL', toUserMessage(error));
    console.error(error);
    process.exit(1);
  }

  // Test finalize imports (ReportService path aliases need OldSkool context)
  const { ReportService } = await import('../NeonUnderworld-OldSkool/src/server/services/report.service');
  const intel = (report.metadata as { intel: { targetPlayerId: string; targetAlias: string } }).intel;
  try {
    const ids = await ReportService.createCombatReports(
      admin.player.id,
      intel.targetPlayerId,
      admin.player.alias,
      intel.targetAlias,
      {
        encounterId: 'test-local',
        attackType: 'HOME_INVASION',
        targetAlias: intel.targetAlias,
        attackerAlias: admin.player.alias,
        attackingThugs: 10,
        ridesUsed: 2,
        weaponCoverage: '100%',
        attackerLosses: 0,
        defenderLosses: 1,
        attackerReturned: 10,
        defenderThugsBefore: 80,
        cashStolen: 0,
        drugsStolen: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
        outcome: 'SUCCESS',
        outcomeLabel: 'Victory',
        scoutConfidence: 0,
        cartelParticipated: false,
        turnsSpent: 3,
        resolvedAt: new Date().toISOString(),
      },
    );
    console.log('reports OK', ids);
  } catch (error) {
    console.error('reports FAIL', toUserMessage(error));
    console.error(error);
    process.exit(1);
  }
}

main()
  .finally(() => prisma.$disconnect());
