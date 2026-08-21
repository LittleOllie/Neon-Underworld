import type { Prisma, PrismaClient } from '@prisma/client';
import {
  archetypeForLadderSlot,
  NPC_LADDER_TOTAL_SLOTS,
  type NpcArchetypeId,
} from '@/config/game/npc-progression-rules';
import {
  buildNpcTargetState,
  businessPurchasePriceForPlan,
} from '@/lib/game-engine/npc-progression/target-state';
import { defaultBusinessName } from '@/config/game/business-rules';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '@/lib/game-engine/happiness';

export async function applyNpcTargetStateToPlayer(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: {
    playerId: string;
    districtId: string;
    seasonId: string;
    archetype: NpcArchetypeId;
    ladderSlot: number;
    growthSeed: number;
    roundDay: number;
    totalSlots?: number;
    nwBand?: { minNw: number; maxNw: number };
  },
): Promise<void> {
  const totalSlots = input.totalSlots ?? NPC_LADDER_TOTAL_SLOTS;
  const target = buildNpcTargetState({
    archetype: input.archetype,
    roundDay: input.roundDay,
    ladderSlot: input.ladderSlot,
    growthSeed: input.growthSeed,
    totalSlots,
    nwBand: input.nwBand,
  });

  const player = await prisma.player.findUniqueOrThrow({ where: { id: input.playerId } });

  await prisma.player.update({
    where: { id: input.playerId },
    data: {
      cash: target.cash,
      bankCash: target.bankCash,
      prostitutes: target.prostitutes,
      thugs: target.thugs,
      rides: target.rides,
      glocks: target.glocks,
      uzis: target.uzis,
      aks: target.aks,
      beer: target.beer,
      condoms: target.condoms,
      hash: target.hash,
      shrooms: target.shrooms,
      coke: target.coke,
      heroin: target.heroin,
      prostituteHappiness: calculateProstituteHappiness({
        prostitutes: target.prostitutes,
        thugs: target.thugs,
        hash: target.hash,
        condoms: target.condoms,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
      }).score,
      thugHappiness: calculateThugHappiness({
        thugs: target.thugs,
        glocks: target.glocks,
        uzis: target.uzis,
        aks: target.aks,
        beer: target.beer,
      }).score,
      businesses: target.businesses.length,
    },
  });

  await prisma.business.deleteMany({ where: { playerId: input.playerId } });
  for (let i = 0; i < target.businesses.length; i++) {
    const plan = target.businesses[i]!;
    await prisma.business.create({
      data: {
        playerId: input.playerId,
        districtId: input.districtId,
        businessType: plan.businessType,
        name: defaultBusinessName(plan.businessType, i + 1),
        purchasePrice: businessPurchasePriceForPlan(plan),
        level: plan.level,
        assignedWorkers: plan.assignedWorkers,
        assignedThugs: plan.assignedThugs,
      },
    });
  }

  await prisma.npcProgressionState.upsert({
    where: { playerId: input.playerId },
    create: {
      playerId: input.playerId,
      archetype: input.archetype,
      growthSeed: input.growthSeed,
      ladderSlot: input.ladderSlot,
      lastProgressedDay: input.roundDay,
      lastProgressedAt: new Date(),
    },
    update: {
      archetype: input.archetype,
      growthSeed: input.growthSeed,
      ladderSlot: input.ladderSlot,
      lastProgressedDay: input.roundDay,
      lastProgressedAt: new Date(),
    },
  });
}

export function progressionMetaForSlot(index: number, _aliasNormalized: string) {
  const ladderSlot = index;
  const growthSeed = index * 7919 + 42;
  const archetype = archetypeForLadderSlot(ladderSlot, NPC_LADDER_TOTAL_SLOTS);
  return { ladderSlot, growthSeed, archetype };
}

/** Deterministic ladder slots for hand-tuned dev-pvp opponents (preserves low/high spread). */
const DEV_PVP_LADDER_SLOTS: Record<string, number> = {
  rustrunner: 2,
  dockrat: 6,
  quarterghost: 10,
  neonviper: 15,
  harborking: 22,
  stripregent: 28,
  coinbroker: 32,
  gridphantom42: 38,
  velvetstrike: 42,
  nightauditor: 47,
};

function growthSeedFromAlias(aliasNormalized: string): number {
  let hash = 0;
  for (let i = 0; i < aliasNormalized.length; i++) {
    hash = (hash * 31 + aliasNormalized.charCodeAt(i)) >>> 0;
  }
  return (hash % 2_000_000_000) || 1;
}

export function progressionMetaForDevPvp(index: number, aliasNormalized: string) {
  const key = aliasNormalized.trim().toLowerCase();
  const ladderSlot = DEV_PVP_LADDER_SLOTS[key] ?? NPC_LADDER_TOTAL_SLOTS + index;
  const growthSeed = growthSeedFromAlias(key);
  const archetype = archetypeForLadderSlot(ladderSlot, NPC_LADDER_TOTAL_SLOTS);
  return { ladderSlot, growthSeed, archetype };
}

/** Upsert progression metadata only — does not modify player resources (dev-pvp safe). */
export async function ensureNpcProgressionState(
  prisma: PrismaClient,
  input: {
    playerId: string;
    archetype: NpcArchetypeId;
    ladderSlot: number;
    growthSeed: number;
    roundDay?: number;
  },
): Promise<void> {
  const roundDay = input.roundDay ?? 1;
  await prisma.npcProgressionState.upsert({
    where: { playerId: input.playerId },
    create: {
      playerId: input.playerId,
      archetype: input.archetype,
      growthSeed: input.growthSeed,
      ladderSlot: input.ladderSlot,
      lastProgressedDay: roundDay,
      lastProgressedAt: new Date(),
    },
    update: {
      archetype: input.archetype,
      growthSeed: input.growthSeed,
      ladderSlot: input.ladderSlot,
    },
  });
}
