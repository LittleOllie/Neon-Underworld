import type { Prisma, PrismaClient } from '@prisma/client';
import {
  applyNpcTargetStateToPlayer,
  progressionMetaForSlot,
} from '@/lib/game-engine/npc-progression/initialize';
import {
  NPC_ARCHETYPE_IDS,
  NPC_LADDER_TOTAL_SLOTS,
  type NpcArchetypeId,
} from '@/config/game/npc-progression-rules';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';
import { aggregateBusinessNwContext } from '@/server/services/business.service';
import {
  buildNpcTargetState,
  canonicalNwForTargetState,
} from '@/lib/game-engine/npc-progression/target-state';
import {
  minAttackTargetNetWorth,
  maxAttackTargetNetWorth,
} from '@/config/game/redlite-rules';
import { getSeasonRoundDay } from '@/lib/game-engine/npc-progression/round-age';
import { districtSlugForLadderSlot } from '@/lib/game-engine/playtest-npc-districts';
import {
  PLAYTEST_NPC_EMAIL_PREFIX,
  reattachPlaytestNpcsToActiveSeason,
  requireExactlyOneActiveSeason,
  tryRevalidateRankingsCache,
  type ActiveSeasonRef,
} from '@/lib/game-engine/playtest-npc-season';
import { ladderSlotFromAlias } from '@/server/services/npc-progression.service';

type PlaytestNpcDb = PrismaClient | Prisma.TransactionClient;

export interface ResetPlaytestNpcsOptions {
  /** Target ladder day — defaults to 1 (early-round initialization). */
  roundDay?: number;
  /** When true, compute round day from active season age instead of roundDay. */
  useSeasonDay?: boolean;
  dryRun?: boolean;
}

export interface PlaytestNpcSnapshot {
  playerId: string;
  alias: string;
  districtSlug: string;
  ladderSlot: number;
  archetype: NpcArchetypeId;
  netWorth: number;
}

export interface AttackCoverageReport {
  attackerNw: number;
  minTarget: number;
  maxTarget: number;
  totalEligible: number;
  byDistrict: Record<
    string,
    {
      count: number;
      lowest: { alias: string; netWorth: number } | null;
      highest: { alias: string; netWorth: number } | null;
      aliases: Array<{ alias: string; netWorth: number }>;
    }
  >;
}

export interface ResetPlaytestNpcsResult {
  activeSeason: ActiveSeasonRef;
  roundDay: number;
  resetCount: number;
  reattached: number;
  snapshots: PlaytestNpcSnapshot[];
  distribution: {
    min: number;
    max: number;
    median: number;
    p25: number;
    p75: number;
  };
  byDistrict: Record<string, { count: number; min: number; max: number; median: number }>;
  attackCoverage: AttackCoverageReport[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[idx] ?? 0;
}

function isValidArchetype(value: string | undefined | null): value is NpcArchetypeId {
  return !!value && (NPC_ARCHETYPE_IDS as readonly string[]).includes(value);
}

function resolveProgressionMeta(
  aliasNormalized: string,
  existing?: {
    ladderSlot: number;
    growthSeed: number;
    archetype: string;
  } | null,
) {
  const ladderSlot = Math.min(
    NPC_LADDER_TOTAL_SLOTS - 1,
    existing?.ladderSlot ?? ladderSlotFromAlias(aliasNormalized, 0),
  );
  const slotMeta = progressionMetaForSlot(ladderSlot, aliasNormalized);
  return {
    ladderSlot,
    growthSeed: existing?.growthSeed ?? slotMeta.growthSeed,
    archetype: isValidArchetype(existing?.archetype) ? existing.archetype : slotMeta.archetype,
  };
}

/** Round-initialization only — rebuilds playtest NPC assets from canonical target state. */
export async function initializePlaytestNpcRoundState(
  prisma: PlaytestNpcDb,
  input: {
    playerId: string;
    districtId: string;
    seasonId: string;
    aliasNormalized: string;
    roundDay: number;
    dryRun?: boolean;
  },
): Promise<{ ladderSlot: number; archetype: NpcArchetypeId; netWorth: number }> {
  const existing = await prisma.npcProgressionState.findUnique({
    where: { playerId: input.playerId },
  });
  const meta = resolveProgressionMeta(input.aliasNormalized, existing);

  if (input.dryRun) {
    const preview = buildNpcTargetState({
      archetype: meta.archetype,
      roundDay: input.roundDay,
      ladderSlot: meta.ladderSlot,
      growthSeed: meta.growthSeed,
      totalSlots: NPC_LADDER_TOTAL_SLOTS,
    });
    return {
      ladderSlot: meta.ladderSlot,
      archetype: meta.archetype,
      netWorth: canonicalNwForTargetState(preview),
    };
  }

  await applyNpcTargetStateToPlayer(prisma, {
      playerId: input.playerId,
      districtId: input.districtId,
      seasonId: input.seasonId,
      archetype: meta.archetype,
      ladderSlot: meta.ladderSlot,
      growthSeed: meta.growthSeed,
      roundDay: input.roundDay,
  });

  const targetDistrictSlug = districtSlugForLadderSlot(meta.ladderSlot);
  const targetDistrict = await prisma.district.findFirst({ where: { slug: targetDistrictSlug } });
  if (targetDistrict && targetDistrict.id !== input.districtId) {
    await prisma.player.update({
      where: { id: input.playerId },
      data: { districtId: targetDistrict.id },
    });
    await prisma.business.updateMany({
      where: { playerId: input.playerId },
      data: { districtId: targetDistrict.id },
    });
  }

  const activeDistrictId = targetDistrict?.id ?? input.districtId;

  await prisma.rankSnapshot.deleteMany({
    where: { playerId: input.playerId, seasonId: input.seasonId },
  });

  const player = await prisma.player.findUniqueOrThrow({
    where: { id: input.playerId },
    include: { ownedBusinesses: true, district: true },
  });
  const bizCtx = aggregateBusinessNwContext(player.ownedBusinesses);
  const netWorth = calculateCanonicalNetWorthFromPlayer(player, bizCtx);

  await prisma.rankSnapshot.create({
    data: {
      playerId: input.playerId,
      seasonId: input.seasonId,
      netWorth,
      rank: 0,
    },
  });

  return { ladderSlot: meta.ladderSlot, archetype: meta.archetype, netWorth };
}

export function buildAttackCoverageReports(
  snapshots: PlaytestNpcSnapshot[],
  attackerNws: number[],
): AttackCoverageReport[] {
  return attackerNws.map((attackerNw) => {
    const minTarget = minAttackTargetNetWorth(attackerNw);
    const maxTarget = maxAttackTargetNetWorth(attackerNw);
    const eligible = snapshots.filter((s) => s.netWorth >= minTarget && s.netWorth <= maxTarget);
    const byDistrict: AttackCoverageReport['byDistrict'] = {};

    for (const npc of eligible) {
      const bucket =
        byDistrict[npc.districtSlug] ??
        (byDistrict[npc.districtSlug] = {
          count: 0,
          lowest: null,
          highest: null,
          aliases: [],
        });
      bucket.count++;
      bucket.aliases.push({ alias: npc.alias, netWorth: npc.netWorth });
      if (!bucket.lowest || npc.netWorth < bucket.lowest.netWorth) {
        bucket.lowest = { alias: npc.alias, netWorth: npc.netWorth };
      }
      if (!bucket.highest || npc.netWorth > bucket.highest.netWorth) {
        bucket.highest = { alias: npc.alias, netWorth: npc.netWorth };
      }
    }

    for (const bucket of Object.values(byDistrict)) {
      bucket.aliases.sort((a, b) => a.netWorth - b.netWorth);
    }

    return {
      attackerNw,
      minTarget,
      maxTarget,
      totalEligible: eligible.length,
      byDistrict,
    };
  });
}

export async function resetPlaytestNpcsForActiveSeason(
  prisma: PlaytestNpcDb,
  options: ResetPlaytestNpcsOptions = {},
): Promise<ResetPlaytestNpcsResult> {
  const seasonRow = await prisma.season.findUniqueOrThrow({
    where: { id: (await requireExactlyOneActiveSeason(prisma)).id },
    select: { id: true, number: true, startsAt: true, endsAt: true },
  });
  const activeSeason: ActiveSeasonRef = { id: seasonRow.id, number: seasonRow.number };

  const roundDay = options.useSeasonDay
    ? getSeasonRoundDay(seasonRow.startsAt, seasonRow.endsAt)
    : (options.roundDay ?? 1);

  const reattach = options.dryRun
    ? { moved: 0 }
    : await reattachPlaytestNpcsToActiveSeason(prisma, activeSeason);

  const players = await prisma.player.findMany({
    where: { user: { email: { startsWith: PLAYTEST_NPC_EMAIL_PREFIX } } },
    include: {
      user: { select: { email: true } },
      district: { select: { slug: true } },
    },
    orderBy: { aliasNormalized: 'asc' },
  });

  const snapshots: PlaytestNpcSnapshot[] = [];

  for (const player of players) {
    const init = await initializePlaytestNpcRoundState(prisma, {
      playerId: player.id,
      districtId: player.districtId,
      seasonId: activeSeason.id,
      aliasNormalized: player.aliasNormalized,
      roundDay,
      dryRun: options.dryRun,
    });

    snapshots.push({
      playerId: player.id,
      alias: player.alias,
      districtSlug: player.district.slug,
      ladderSlot: init.ladderSlot,
      archetype: init.archetype,
      netWorth: init.netWorth,
    });
  }

  if (!options.dryRun) {
    await tryRevalidateRankingsCache(activeSeason.id);
  }

  const nwValues = [...snapshots.map((s) => s.netWorth)].sort((a, b) => a - b);
  const byDistrict: ResetPlaytestNpcsResult['byDistrict'] = {};
  for (const snap of snapshots) {
    const bucket =
      byDistrict[snap.districtSlug] ??
      (byDistrict[snap.districtSlug] = { count: 0, min: Infinity, max: 0, median: 0 });
    bucket.count++;
    bucket.min = Math.min(bucket.min, snap.netWorth);
    bucket.max = Math.max(bucket.max, snap.netWorth);
  }
  for (const slug of Object.keys(byDistrict)) {
    const values = snapshots
      .filter((s) => s.districtSlug === slug)
      .map((s) => s.netWorth)
      .sort((a, b) => a - b);
    byDistrict[slug]!.median = percentile(values, 0.5);
    if (byDistrict[slug]!.min === Infinity) byDistrict[slug]!.min = 0;
  }

  const attackCoverage = buildAttackCoverageReports(snapshots, [
    25_000,
    50_000,
    100_000,
    250_000,
    500_000,
    1_000_000,
  ]);

  return {
    activeSeason,
    roundDay,
    resetCount: snapshots.length,
    reattached: reattach.moved,
    snapshots,
    distribution: {
      min: nwValues[0] ?? 0,
      max: nwValues[nwValues.length - 1] ?? 0,
      median: percentile(nwValues, 0.5),
      p25: percentile(nwValues, 0.25),
      p75: percentile(nwValues, 0.75),
    },
    byDistrict,
    attackCoverage,
  };
}
