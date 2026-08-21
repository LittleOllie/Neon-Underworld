/**
 * Seeds 50 attackable playtest NPCs (isSystemPlayer: false) for friend alpha testing.
 * Safe to re-run — skips existing aliases; optionally jitters existing NPC resources.
 *
 *   npm run db:seed:playtest-npcs
 *   SEED_NPC_JITTER=true npm run db:seed:playtest-npcs
 */
import type { PrismaClient } from '@prisma/client';
import {
  hashPassword,
  normalizeAlias,
} from '../src/lib/security/crypto';
import { TURNS_CONFIG } from '../src/config/game/balance';
import { createInitialTurnState } from '../src/lib/game-engine/turns';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { aggregateBusinessNwContext } from '../src/server/services/business.service';
import { createSeededRng } from '../src/lib/game-engine/rng';
import { resolveNpcSeedAvatar } from '../src/lib/game-engine/npc-avatar';
import {
  applyNpcTargetStateToPlayer,
  progressionMetaForSlot,
} from '../src/lib/game-engine/npc-progression/initialize';
import { progressNpcPlayer } from '../src/server/services/npc-progression.service';
import {
  buildNpcTargetState,
  canonicalNwForTargetState,
} from '../src/lib/game-engine/npc-progression/target-state';
import { NPC_LADDER_TOTAL_SLOTS } from '../src/config/game/npc-progression-rules';
import {
  PLAYTEST_NPC_EMAIL_PREFIX,
  reattachPlaytestNpcsToActiveSeason,
  requireExactlyOneActiveSeason,
  tryRevalidateRankingsCache,
} from '../src/lib/game-engine/playtest-npc-season';

export const PLAYTEST_NPC_COUNT = 50;

const NAME_PARTS = [
  'Neon', 'Dock', 'Grid', 'Velvet', 'Cipher', 'Ash', 'Wire', 'Pulse', 'Rust', 'Harbor',
  'Strip', 'Quarter', 'Lantern', 'Fleet', 'Mirror', 'Quiet', 'Silver', 'Brass', 'Copper', 'Obsidian',
  'Runner', 'Wolf', 'King', 'Ghost', 'Baron', 'Strike', 'Heir', 'Broker', 'Phantom', 'Regent',
  'Syndicate', 'Warden', 'Collector', 'Signal', 'Serpent', 'Saint', 'Duke', 'Consul', 'Monarch', 'Auditor',
] as const;

import { districtSlugForLadderSlot } from '../src/lib/game-engine/playtest-npc-districts';

function playtestNpcAlias(index: number): string {
  const a = NAME_PARTS[index % 20]!;
  const b = NAME_PARTS[20 + (index % 20)]!;
  const n = String(index + 1).padStart(2, '0');
  return `${a}${b}${n}`;
}

async function createRankSnapshots(
  prisma: PrismaClient,
  playerId: string,
  seasonId: string,
  netWorth: number,
  rng: ReturnType<typeof createSeededRng>,
) {
  const drift = Math.max(500, Math.round(netWorth * rng.nextFloat(0.03, 0.12)));
  await prisma.rankSnapshot.create({
    data: {
      playerId,
      seasonId,
      netWorth: Math.max(0, netWorth - drift),
      rank: 0,
      createdAt: new Date(Date.now() - rng.nextInt(2, 10) * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.rankSnapshot.create({
    data: {
      playerId,
      seasonId,
      netWorth: Math.max(0, netWorth - Math.round(drift * 0.4)),
      rank: 0,
      createdAt: new Date(Date.now() - rng.nextInt(1, 3) * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.rankSnapshot.create({
    data: { playerId, seasonId, netWorth, rank: 0 },
  });
}

export async function seedPlaytestNpcs(
  prisma: PrismaClient,
  options?: { jitterExisting?: boolean },
) {
  const jitterExisting = options?.jitterExisting ?? process.env.SEED_NPC_JITTER === 'true';

  const season = await requireExactlyOneActiveSeason(prisma);
  const reattach = await reattachPlaytestNpcsToActiveSeason(prisma, season);
  if (reattach.moved > 0) {
    console.log(
      `Reattached ${reattach.moved} playtest NPC(s) to active season ${season.number}.`,
    );
    const invalidated = await tryRevalidateRankingsCache(season.id);
    if (!invalidated) {
      console.warn('Rankings cache not invalidated — restart npm run dev if Rankings look stale.');
    }
  }

  const districts = await prisma.district.findMany();
  const districtMap = new Map(districts.map((d) => [d.slug, d]));

  let created = 0;
  let skipped = 0;
  let progressed = 0;

  for (let i = 0; i < PLAYTEST_NPC_COUNT; i++) {
    const alias = playtestNpcAlias(i);
    const aliasNorm = normalizeAlias(alias);
    const districtSlug = districtSlugForLadderSlot(i);
    const meta = progressionMetaForSlot(i, aliasNorm);
    const existing = await prisma.player.findUnique({
      where: { aliasNormalized: aliasNorm },
      include: { user: true },
    });

    if (existing) {
      skipped++;
      const isPlaytestNpc = existing.user.email.startsWith(PLAYTEST_NPC_EMAIL_PREFIX);
      if (isPlaytestNpc) {
        if (existing.seasonId !== season.id) {
          await prisma.player.update({
            where: { id: existing.id },
            data: { seasonId: season.id },
          });
        }
        const hasProgression = await prisma.npcProgressionState.findUnique({
          where: { playerId: existing.id },
        });
        if (!hasProgression) {
          await applyNpcTargetStateToPlayer(prisma, {
            playerId: existing.id,
            districtId: existing.districtId,
            seasonId: season.id,
            archetype: meta.archetype,
            ladderSlot: meta.ladderSlot,
            growthSeed: meta.growthSeed,
            roundDay: 1,
          });
          progressed++;
        }
        if (jitterExisting) {
          await progressNpcPlayer(prisma, {
            playerId: existing.id,
            email: existing.user.email,
            aliasNormalized: aliasNorm,
            districtId: existing.districtId,
            roundDay: 1,
            force: true,
          });
          progressed++;
        }
        await prisma.playerStatusExt.upsert({
          where: { playerId: existing.id },
          create: { playerId: existing.id, lastSeenAt: new Date() },
          update: { lastSeenAt: new Date(Date.now() - 12 * 60 * 60 * 1000) },
        });
      }
      continue;
    }

    const district = districtMap.get(districtSlug);
    if (!district) throw new Error(`District not found: ${districtSlug}`);

    const email = `${PLAYTEST_NPC_EMAIL_PREFIX}${aliasNorm}@neonunderworld.local`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(`playtest-npc-${aliasNorm}-not-for-login`),
        role: 'PLAYER',
      },
    });

    const preview = buildNpcTargetState({
      archetype: meta.archetype,
      roundDay: 1,
      ladderSlot: meta.ladderSlot,
      growthSeed: meta.growthSeed,
      totalSlots: NPC_LADDER_TOTAL_SLOTS,
    });

    const player = await prisma.player.create({
      data: {
        userId: user.id,
        alias,
        aliasNormalized: aliasNorm,
        districtId: district.id,
        seasonId: season.id,
        cash: 0,
        prostitutes: 0,
        thugs: 0,
        isSystemPlayer: false,
        avatar: resolveNpcSeedAvatar(aliasNorm),
        prostitutePayoutPercent: 50,
      },
    });

    const initialTurns = createInitialTurnState();
    await prisma.playerTurnState.create({
      data: {
        playerId: player.id,
        currentTurns: initialTurns.currentTurns,
        lastRegeneratedAt: initialTurns.lastRegeneratedAt,
        turnCap: TURNS_CONFIG.turnCap,
        regenerationRate: TURNS_CONFIG.regenerationRatePerMs,
      },
    });

    await applyNpcTargetStateToPlayer(prisma, {
      playerId: player.id,
      districtId: district.id,
      seasonId: season.id,
      archetype: meta.archetype,
      ladderSlot: meta.ladderSlot,
      growthSeed: meta.growthSeed,
      roundDay: 1,
    });

    const refreshed = await prisma.player.findUniqueOrThrow({
      where: { id: player.id },
      include: { ownedBusinesses: true },
    });
    const bizCtx = aggregateBusinessNwContext(refreshed.ownedBusinesses);
    const nw = calculateCanonicalNetWorthFromPlayer(refreshed, bizCtx);
    const rng = createSeededRng(i * 1337);
    await createRankSnapshots(prisma, player.id, season.id, nw, rng);

    await prisma.playerStatusExt.upsert({
      where: { playerId: player.id },
      create: {
        playerId: player.id,
        lastSeenAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      update: {
        lastSeenAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
    });

    created++;
    console.log(
      `  + ${alias} (${district.name}) — ${meta.archetype} NW $${nw.toLocaleString()} (target $${canonicalNwForTargetState(preview).toLocaleString()})`,
    );
  }

  console.log(
    `Playtest NPC seed complete: ${created} created, ${skipped} already existed${progressed ? `, ${progressed} re-progressed` : ''}.`,
  );
}

async function main() {
  const { assertDevSeedAllowed } = await import('./lib/dev-guard');
  assertDevSeedAllowed('seed-playtest-npcs');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    console.log(`Seeding ${PLAYTEST_NPC_COUNT} playtest NPC opponents...`);
    await seedPlaytestNpcs(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = process.argv[1]?.includes('seed-playtest-npcs');
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
