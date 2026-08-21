import type { PrismaClient } from '@prisma/client';
import { SeasonStatus } from '@prisma/client';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '@/lib/game-engine/happiness';
import {
  isProgressionNpcAccount,
  progressionNpcEmailOrFilters,
} from '@/lib/game-engine/npc-progression/identification';
import {
  businessesFromRecords,
  playerAssetsFromRecord,
  reconcileBusinessesTowardTarget,
} from '@/lib/game-engine/npc-progression/reconcile';
import { getSeasonRoundDay } from '@/lib/game-engine/npc-progression/round-age';
import {
  applyNpcProgressionTicks,
  computeDueTickCount,
} from '@/lib/game-engine/npc-progression/tick';
import {
  buildNpcTargetState,
  businessPurchasePriceForPlan,
  canonicalNwForTargetState,
} from '@/lib/game-engine/npc-progression/target-state';
import {
  archetypeForLadderSlot,
  NPC_LADDER_TOTAL_SLOTS,
  NPC_PROGRESSION_TICK_HOURS,
  type NpcArchetypeId,
} from '@/config/game/npc-progression-rules';
import { defaultBusinessName } from '@/config/game/business-rules';

export interface NpcProgressionResult {
  seasonId: string;
  roundDay: number;
  processed: number;
  skipped: number;
  errors: number;
  ticksApplied?: number;
}

export interface NpcProgressionOptions {
  /** Dev override — compute targets as if round is on this day. */
  forceDay?: number;
  /** Process at least one tick even when not yet due. */
  force?: boolean;
  /** Limit batch size (testing). */
  limit?: number;
  /** Dev: treat as if this many hours elapsed since last tick. */
  simulateElapsedHours?: number;
  /** Dev override for local-npc fixture participation. */
  includeLocalNpcs?: boolean;
}

function growthSeedFromAlias(aliasNormalized: string): number {
  let hash = 0;
  for (let i = 0; i < aliasNormalized.length; i++) {
    hash = (hash * 31 + aliasNormalized.charCodeAt(i)) >>> 0;
  }
  return (hash % 2_000_000_000) || 1;
}

export function ladderSlotFromAlias(aliasNormalized: string, fallback: number): number {
  const match = aliasNormalized.match(/(\d+)$/);
  if (match) return Math.max(0, parseInt(match[1]!, 10) - 1);
  return fallback;
}

export async function progressNpcPlayer(
  tx: PrismaClient,
  input: {
    playerId: string;
    email: string;
    aliasNormalized: string;
    districtId: string;
    roundDay: number;
    force?: boolean;
    totalSlots?: number;
    simulateElapsedHours?: number;
    now?: Date;
  },
): Promise<'processed' | 'skipped'> {
  if (!isProgressionNpcAccount({ isSystemPlayer: false, email: input.email })) {
    return 'skipped';
  }

  const totalSlots = input.totalSlots ?? NPC_LADDER_TOTAL_SLOTS;
  const now = input.now ?? new Date();
  const existing = await tx.npcProgressionState.findUnique({ where: { playerId: input.playerId } });
  const ladderSlot = existing?.ladderSlot ?? ladderSlotFromAlias(input.aliasNormalized, 0);
  const growthSeed = existing?.growthSeed ?? growthSeedFromAlias(input.aliasNormalized);
  const archetype: NpcArchetypeId =
    (existing?.archetype as NpcArchetypeId) ?? archetypeForLadderSlot(ladderSlot, totalSlots);

  const tickCount = computeDueTickCount({
    lastProgressedAt: existing?.lastProgressedAt ?? null,
    now,
    simulateElapsedHours: input.simulateElapsedHours,
    force: input.force,
  });

  if (tickCount <= 0) {
    return 'skipped';
  }

  const player = await tx.player.findUniqueOrThrow({
    where: { id: input.playerId },
    include: { ownedBusinesses: true },
  });

  const currentAssets = playerAssetsFromRecord(player);
  currentAssets.businesses = businessesFromRecords(player.ownedBusinesses);

  const baseTickIndex = existing
    ? Math.floor(
        (now.getTime() - existing.lastProgressedAt.getTime()) / (NPC_PROGRESSION_TICK_HOURS * 3_600_000),
      )
    : 0;

  const ticked = applyNpcProgressionTicks(
    currentAssets,
    {
      archetype,
      roundDay: input.roundDay,
      ladderSlot,
      growthSeed,
      totalSlots,
    },
    tickCount,
    Math.max(0, baseTickIndex),
  );

  const target = buildNpcTargetState({
    archetype,
    roundDay: input.roundDay,
    ladderSlot,
    growthSeed,
    totalSlots,
  });

  const businessRecovery = Math.min(0.05 * tickCount, 0.2);
  const reconciled = {
    ...ticked,
    businesses: reconcileBusinessesTowardTarget(
      currentAssets.businesses,
      target.businesses,
      businessRecovery,
    ),
  };

  await tx.player.update({
    where: { id: input.playerId },
    data: {
      cash: reconciled.cash,
      bankCash: reconciled.bankCash,
      prostitutes: reconciled.prostitutes,
      thugs: reconciled.thugs,
      rides: reconciled.rides,
      glocks: reconciled.glocks,
      uzis: reconciled.uzis,
      aks: reconciled.aks,
      beer: reconciled.beer,
      condoms: reconciled.condoms,
      hash: reconciled.hash,
      shrooms: reconciled.shrooms,
      coke: reconciled.coke,
      heroin: reconciled.heroin,
      prostituteHappiness: calculateProstituteHappiness({
        prostitutes: reconciled.prostitutes,
        thugs: reconciled.thugs,
        hash: reconciled.hash,
        condoms: reconciled.condoms,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
      }).score,
      thugHappiness: calculateThugHappiness({
        thugs: reconciled.thugs,
        glocks: reconciled.glocks,
        uzis: reconciled.uzis,
        aks: reconciled.aks,
        beer: reconciled.beer,
      }).score,
      businesses: reconciled.businesses.length,
    },
  });

  await reconcileNpcBusinesses(
    tx,
    input.playerId,
    input.districtId,
    currentAssets.businesses,
    reconciled.businesses,
  );

  await tx.npcProgressionState.upsert({
    where: { playerId: input.playerId },
    create: {
      playerId: input.playerId,
      archetype,
      growthSeed,
      ladderSlot,
      lastProgressedDay: input.roundDay,
      lastProgressedAt: now,
    },
    update: {
      archetype,
      growthSeed,
      ladderSlot,
      lastProgressedDay: input.roundDay,
      lastProgressedAt: now,
    },
  });

  const nw = canonicalNwForTargetState(reconciled);
  await tx.rankSnapshot.create({
    data: {
      playerId: input.playerId,
      seasonId: player.seasonId,
      netWorth: nw,
      rank: 0,
    },
  });

  return 'processed';
}

async function reconcileNpcBusinesses(
  tx: PrismaClient,
  playerId: string,
  districtId: string,
  current: ReturnType<typeof businessesFromRecords>,
  target: ReturnType<typeof businessesFromRecords>,
): Promise<void> {
  const existing = await tx.business.findMany({ where: { playerId }, orderBy: { createdAt: 'asc' } });

  for (let i = 0; i < target.length; i++) {
    const plan = target[i]!;
    const row = existing[i];
    const purchasePrice = businessPurchasePriceForPlan(plan);
    if (row) {
      await tx.business.update({
        where: { id: row.id },
        data: {
          businessType: plan.businessType,
          level: plan.level,
          assignedWorkers: plan.assignedWorkers,
          assignedThugs: plan.assignedThugs,
          purchasePrice,
          upgradeTargetLevel: null,
          upgradeStartedAt: null,
          upgradeCompletesAt: null,
        },
      });
    } else {
      await tx.business.create({
        data: {
          playerId,
          districtId,
          businessType: plan.businessType,
          name: defaultBusinessName(plan.businessType, i + 1),
          purchasePrice,
          level: plan.level,
          assignedWorkers: plan.assignedWorkers,
          assignedThugs: plan.assignedThugs,
        },
      });
    }
  }

  if (existing.length > target.length) {
    const excess = existing.slice(target.length);
    for (const row of excess) {
      await tx.business.delete({ where: { id: row.id } });
    }
  }
}

function applyLocalNpcEnvOverride(includeLocalNpcs?: boolean): void {
  if (includeLocalNpcs === true) {
    process.env.NPC_PROGRESSION_INCLUDE_LOCAL = 'true';
  } else if (includeLocalNpcs === false) {
    process.env.NPC_PROGRESSION_INCLUDE_LOCAL = 'false';
  }
}

export async function progressSeasonNpcs(
  prisma: PrismaClient,
  seasonId: string,
  options: NpcProgressionOptions = {},
): Promise<NpcProgressionResult> {
  applyLocalNpcEnvOverride(options.includeLocalNpcs);

  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const roundDay = options.forceDay ?? getSeasonRoundDay(season.startsAt, season.endsAt);

  const candidates = await prisma.player.findMany({
    where: {
      seasonId,
      isSystemPlayer: false,
      user: { OR: progressionNpcEmailOrFilters() },
    },
    include: { user: true },
    orderBy: { aliasNormalized: 'asc' },
    take: options.limit,
  });

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const candidate of candidates) {
    try {
      const outcome = await progressNpcPlayer(prisma, {
        playerId: candidate.id,
        email: candidate.user.email,
        aliasNormalized: candidate.aliasNormalized,
        districtId: candidate.districtId,
        roundDay,
        force: options.force,
        simulateElapsedHours: options.simulateElapsedHours,
      });
      if (outcome === 'processed') processed++;
      else skipped++;
    } catch {
      errors++;
    }
  }

  return { seasonId, roundDay, processed, skipped, errors };
}

export async function progressActiveSeasonNpcs(
  prisma: PrismaClient,
  options: NpcProgressionOptions = {},
): Promise<NpcProgressionResult | null> {
  const season = await prisma.season.findFirst({
    where: { status: SeasonStatus.ACTIVE },
    orderBy: { number: 'desc' },
  });
  if (!season) return null;
  return progressSeasonNpcs(prisma, season.id, options);
}

/** Process NPCs whose 6-hour tick window is due (alias for scheduled / dev invocation). */
export async function progressDueNpcs(
  prisma: PrismaClient,
  options: NpcProgressionOptions = {},
): Promise<NpcProgressionResult | null> {
  return progressActiveSeasonNpcs(prisma, options);
}

export async function maybeProgressActiveSeasonNpcs(
  prisma: PrismaClient,
): Promise<void> {
  await progressDueNpcs(prisma);
}
