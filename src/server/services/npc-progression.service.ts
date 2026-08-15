import type { PrismaClient } from '@prisma/client';
import { SeasonStatus } from '@prisma/client';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '@/lib/game-engine/happiness';
import { isProgressionNpcAccount } from '@/lib/game-engine/npc-progression/identification';
import {
  compoundRecoveryRate,
  businessesFromRecords,
  playerAssetsFromRecord,
  reconcileTowardTarget,
} from '@/lib/game-engine/npc-progression/reconcile';
import { getSeasonRoundDay } from '@/lib/game-engine/npc-progression/round-age';
import {
  buildNpcTargetState,
  businessPurchasePriceForPlan,
  canonicalNwForTargetState,
} from '@/lib/game-engine/npc-progression/target-state';
import {
  archetypeForLadderSlot,
  NPC_LADDER_TOTAL_SLOTS,
  type NpcArchetypeId,
} from '@/config/game/npc-progression-rules';
import { defaultBusinessName } from '@/config/game/business-rules';

export interface NpcProgressionResult {
  seasonId: string;
  roundDay: number;
  processed: number;
  skipped: number;
  errors: number;
}

export interface NpcProgressionOptions {
  /** Dev override — compute targets as if round is on this day. */
  forceDay?: number;
  /** Reconcile even when lastProgressedDay >= roundDay. */
  force?: boolean;
  /** Limit batch size (testing). */
  limit?: number;
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
  },
): Promise<'processed' | 'skipped'> {
  if (!isProgressionNpcAccount({ isSystemPlayer: false, email: input.email })) {
    return 'skipped';
  }

  const totalSlots = input.totalSlots ?? NPC_LADDER_TOTAL_SLOTS;
  const existing = await tx.npcProgressionState.findUnique({ where: { playerId: input.playerId } });
  const ladderSlot = existing?.ladderSlot ?? ladderSlotFromAlias(input.aliasNormalized, 0);
  const growthSeed = existing?.growthSeed ?? growthSeedFromAlias(input.aliasNormalized);
  const archetype: NpcArchetypeId = (existing?.archetype as NpcArchetypeId) ?? archetypeForLadderSlot(ladderSlot, totalSlots);

  if (!input.force && existing && existing.lastProgressedDay >= input.roundDay) {
    return 'skipped';
  }

  const player = await tx.player.findUniqueOrThrow({
    where: { id: input.playerId },
    include: { ownedBusinesses: true },
  });

  const daysToApply = existing
    ? Math.max(1, input.roundDay - existing.lastProgressedDay)
    : input.roundDay;
  const recoveryRate = compoundRecoveryRate(daysToApply);

  const target = buildNpcTargetState({
    archetype,
    roundDay: input.roundDay,
    ladderSlot,
    growthSeed,
    totalSlots,
  });

  const currentAssets = playerAssetsFromRecord(player);
  currentAssets.businesses = businessesFromRecords(player.ownedBusinesses);

  const reconciled = reconcileTowardTarget(currentAssets, target, recoveryRate);

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

  await reconcileNpcBusinesses(tx, input.playerId, input.districtId, currentAssets.businesses, reconciled.businesses);

  await tx.npcProgressionState.upsert({
    where: { playerId: input.playerId },
    create: {
      playerId: input.playerId,
      archetype,
      growthSeed,
      ladderSlot,
      lastProgressedDay: input.roundDay,
      lastProgressedAt: new Date(),
    },
    update: {
      archetype,
      growthSeed,
      ladderSlot,
      lastProgressedDay: input.roundDay,
      lastProgressedAt: new Date(),
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

export async function progressSeasonNpcs(
  prisma: PrismaClient,
  seasonId: string,
  options: NpcProgressionOptions = {},
): Promise<NpcProgressionResult> {
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const roundDay =
    options.forceDay ??
    getSeasonRoundDay(season.startsAt, season.endsAt);

  const candidates = await prisma.player.findMany({
    where: {
      seasonId,
      isSystemPlayer: false,
      user: {
        OR: [
          { email: { startsWith: 'playtest-npc+' } },
          { email: { startsWith: 'dev-pvp+' } },
        ],
      },
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

export async function maybeProgressActiveSeasonNpcs(
  prisma: PrismaClient,
): Promise<void> {
  await progressActiveSeasonNpcs(prisma);
}
