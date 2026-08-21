/**
 * Backfill stable, varied avatars for NPC / system / seeded opponent accounts.
 *
 * Safe to run multiple times (idempotent). NEVER modifies normal human player avatars.
 *
 * Usage:
 *   npm run db:backfill-npc-avatars
 *
 * Production: invoke explicitly only when needed (does not run automatically).
 */
import { PrismaClient } from '@prisma/client';
import { PlayerAvatarSource } from '@prisma/client';
import {
  assignNpcAvatar,
  isNpcManagedAccount,
  npcAvatarNeedsBackfill,
} from '../src/lib/game-engine/npc-avatar';

const prisma = new PrismaClient();

export async function backfillNpcAvatars(options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun ?? false;

  const players = await prisma.player.findMany({
    select: {
      id: true,
      alias: true,
      aliasNormalized: true,
      avatar: true,
      isSystemPlayer: true,
      user: { select: { email: true } },
    },
  });

  let examined = 0;
  let eligible = 0;
  let updated = 0;
  let preserved = 0;
  let skippedHuman = 0;

  for (const player of players) {
    examined++;
    const managed = isNpcManagedAccount({
      isSystemPlayer: player.isSystemPlayer,
      email: player.user.email,
    });

    if (!managed) {
      skippedHuman++;
      continue;
    }

    if (!npcAvatarNeedsBackfill(player.avatar)) {
      preserved++;
      continue;
    }

    eligible++;
    const nextAvatar = assignNpcAvatar(player.aliasNormalized);

    if (player.avatar === nextAvatar) {
      preserved++;
      continue;
    }

    if (!dryRun) {
      await prisma.player.update({
        where: { id: player.id },
        data: {
          avatar: nextAvatar,
          avatarSource: PlayerAvatarSource.CHARACTER,
        },
      });
    }

    updated++;
    console.log(`  ${dryRun ? '[dry-run] ' : ''}${player.alias}: ${player.avatar ?? 'null'} → ${nextAvatar}`);
  }

  return { examined, eligible, updated, preserved, skippedHuman, dryRun };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Backfilling NPC avatars${dryRun ? ' (dry run)' : ''}...`);

  const result = await backfillNpcAvatars({ dryRun });

  console.log(
    JSON.stringify(
      {
        ...result,
        message: dryRun
          ? 'Dry run complete — no records modified'
          : 'NPC avatar backfill complete',
      },
      null,
      2,
    ),
  );
}

const isDirectRun = process.argv[1]?.includes('backfill-npc-avatars');
if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
