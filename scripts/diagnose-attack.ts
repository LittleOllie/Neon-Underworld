/**
 * Read-only-ish attack diagnostic — rolls back combat if it succeeds.
 * Usage: DATABASE_URL="..." npx tsx scripts/diagnose-attack.ts [attackerAlias]
 */
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { resolveAttackEncounter } from '../src/server/services/combat.service';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { validateAttackEligibilityCode } from '../src/lib/game-engine/combat/eligibility';
import { toUserMessage } from '../src/lib/game-engine/gameplay-errors';

const alias = process.argv[2] ?? 'Herma';

const prisma = new PrismaClient();

async function main() {
  const attacker = await prisma.player.findFirst({
    where: { alias: { equals: alias, mode: 'insensitive' } },
    include: { turnState: true, district: true, user: true },
  });
  if (!attacker?.user) {
    console.error('Attacker not found:', alias);
    process.exit(1);
  }

  console.log('Attacker:', attacker.alias, '| city:', attacker.district.name, '| turns:', attacker.turnState?.currentTurns);

  const reports = await prisma.report.findMany({
    where: { playerId: attacker.id, category: 'SCOUT' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const now = Date.now();
  const intelReports = reports.filter((r) => {
    const m = r.metadata as { type?: string; intel?: { targetPlayerId: string; targetAlias: string; expiresAt: string } };
    return m?.type === 'PLAYER_INTEL' && m.intel && new Date(m.intel.expiresAt).getTime() > now;
  });

  console.log('Valid intel reports:', intelReports.length);

  for (const report of intelReports) {
    const intel = (report.metadata as { intel: {
      targetPlayerId: string;
      targetAlias: string;
      expiresAt: string;
    } }).intel;

    const defender = await prisma.player.findUnique({
      where: { id: intel.targetPlayerId },
      include: { district: true, statusExt: true },
    });
    if (!defender) {
      console.log(' -', intel.targetAlias, ': target missing');
      continue;
    }

    const sameCity = defender.districtId === attacker.districtId;
    const attackerNw = calculateCanonicalNetWorthFromPlayer(attacker);
    const defenderNw = calculateCanonicalNetWorthFromPlayer(defender);
    const code = validateAttackEligibilityCode({
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerDistrictId: attacker.districtId,
      defenderDistrictId: defender.districtId,
      attackType: 'HOME_INVASION',
      attackingThugs: 50,
      attackerNw,
      defenderNw,
      attackerTurns: attacker.turnState?.currentTurns ?? 0,
      attackerThugs: attacker.thugs,
      attackerRides: attacker.rides,
      attackerLifeStatus: attacker.lifeStatus,
      attackerTravelling: attacker.travelling,
      defenderLifeStatus: defender.lifeStatus,
      defenderTravelling: defender.travelling,
      intelReport: intel as never,
      attacksOnTargetLast24h: 0,
      defenderOfflineProtected: false,
    });

    console.log(` - ${intel.targetAlias} | sameCity=${sameCity} | eligibility=${code ?? 'OK'} | report=${report.id}`);

    if (!sameCity || code) continue;

    console.log('\nAttempting dry-run resolveAttackEncounter (will commit — use test account)...');
    try {
      const result = await resolveAttackEncounter(
        attacker.id,
        attacker.userId,
        { kind: 'intel', scoutReportId: report.id },
        'HOME_INVASION',
        50,
        uuidv4(),
        (p) => calculateCanonicalNetWorthFromPlayer(p as never),
      );
      console.log('SUCCESS outcome:', result.outcome, 'encounter:', result.encounterId);
    } catch (error) {
      console.error('FAILED:', error);
      if (error instanceof Error) {
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
      }
      console.error('toUserMessage:', toUserMessage(error));
    }
    break;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
