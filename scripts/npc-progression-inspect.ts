#!/usr/bin/env npx tsx
/** Inspect NPC progression state — dev/ops helper. */
import { PrismaClient } from '@prisma/client';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { aggregateBusinessNwContext } from '../src/server/services/business.service';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.player.findMany({
    where: {
      isSystemPlayer: false,
      OR: [
        { user: { email: { startsWith: 'playtest-npc+' } } },
        { user: { email: { startsWith: 'dev-pvp+' } } },
      ],
    },
    include: {
      user: true,
      district: true,
      ownedBusinesses: true,
      npcProgression: true,
    },
    orderBy: { aliasNormalized: 'asc' },
  });

  console.log(`Progression-managed NPCs: ${rows.length}\n`);
  for (const p of rows) {
    const biz = aggregateBusinessNwContext(p.ownedBusinesses);
    const nw = calculateCanonicalNetWorthFromPlayer(p, biz);
    const prog = p.npcProgression;
    console.log(
      `${p.alias.padEnd(16)} ${p.district.slug.padEnd(12)} NW $${nw.toLocaleString().padStart(12)} | ${prog?.archetype ?? 'NO STATE'} slot ${prog?.ladderSlot ?? '-'} day ${prog?.lastProgressedDay ?? '-'}`,
    );
  }
}

main()
  .finally(() => prisma.$disconnect());
