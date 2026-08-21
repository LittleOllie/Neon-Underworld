import { prisma } from '@/lib/db/prisma';
import { STARTING_RESOURCES } from '@/config/game/balance';
import { createInitialTurnState } from '@/lib/game-engine/turns';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '@/lib/game-engine/happiness';
import { isHumanPlayer } from '@/lib/game-engine/human-player';
import { GAMEPLAY_ANALYTICS_EVENTS } from '@/config/game/analytics-events';
import { GameplayAnalyticsService } from '@/server/services/gameplay-analytics.service';
import {
  clearPlayerSeasonActivatedAt,
  getPlayerSeasonActivatedAt,
  setPlayerSeasonActivatedAt,
} from '@/lib/db/admin-analytics-db';
import { isAdminSchemaReady } from '@/lib/db/admin-schema-readiness';
import { resetPlayerRoundStatusExt } from '@/server/services/round-rollover.service';
import { isSeasonEnforcementEnabled } from '@/lib/game-engine/season-guard';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export type RoundActivationResult =
  | { activated: false; reason: 'npc' | 'already_active' | 'no_season' | 'season_inactive' }
  | { activated: true; firstActivation: boolean };

/** Reset round-specific player empire fields to canonical starting resources. */
export async function resetPlayerRoundState(tx: Tx, playerId: string, seasonId: string): Promise<void> {
  const prostituteHappiness = calculateProstituteHappiness({
    prostitutes: STARTING_RESOURCES.prostitutes,
    thugs: STARTING_RESOURCES.thugs,
    hash: STARTING_RESOURCES.hash,
    condoms: STARTING_RESOURCES.condoms,
    prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
  }).score;

  const thugHappiness = calculateThugHappiness({
    thugs: STARTING_RESOURCES.thugs,
    glocks: STARTING_RESOURCES.glocks,
    uzis: STARTING_RESOURCES.uzis,
    aks: STARTING_RESOURCES.aks,
    beer: STARTING_RESOURCES.beer,
  }).score;

  const initialTurns = createInitialTurnState();

  await tx.player.update({
    where: { id: playerId },
    data: {
      seasonId,
      cash: STARTING_RESOURCES.cash,
      bankCash: 0,
      prostitutes: STARTING_RESOURCES.prostitutes,
      thugs: STARTING_RESOURCES.thugs,
      rides: STARTING_RESOURCES.rides,
      glocks: STARTING_RESOURCES.glocks,
      uzis: STARTING_RESOURCES.uzis,
      aks: STARTING_RESOURCES.aks,
      beer: STARTING_RESOURCES.beer,
      condoms: STARTING_RESOURCES.condoms,
      hash: STARTING_RESOURCES.hash,
      shrooms: STARTING_RESOURCES.shrooms,
      coke: STARTING_RESOURCES.coke,
      heroin: STARTING_RESOURCES.heroin,
      prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
      prostituteHappiness,
      thugHappiness,
      businesses: 0,
      health: 100,
      lifeStatus: 'ACTIVE',
      travelling: false,
      travelDestination: null,
      travelArrival: null,
      protectionStatus: 'NONE',
      cartelId: null,
      cartelDonationPercent: 0,
    },
  });

  await clearPlayerSeasonActivatedAt(tx, playerId);
  await resetPlayerRoundStatusExt(tx, playerId);

  await tx.business.deleteMany({ where: { playerId } });
  await tx.marketListing.updateMany({
    where: { sellerId: playerId, status: 'ACTIVE' },
    data: { status: 'CANCELLED' },
  });

  await tx.playerTurnState.upsert({
    where: { playerId },
    create: {
      playerId,
      currentTurns: initialTurns.currentTurns,
      lastRegeneratedAt: initialTurns.lastRegeneratedAt,
      turnCap: initialTurns.turnCap,
      regenerationRate: initialTurns.regenerationRatePerMs,
    },
    update: {
      currentTurns: initialTurns.currentTurns,
      lastRegeneratedAt: initialTurns.lastRegeneratedAt,
      turnCap: initialTurns.turnCap,
      regenerationRate: initialTurns.regenerationRatePerMs,
    },
  });

  await tx.playerInventory.upsert({
    where: { playerId },
    create: {
      playerId,
      thugs: STARTING_RESOURCES.thugs,
      workers: STARTING_RESOURCES.prostitutes,
      weapons: STARTING_RESOURCES.glocks + STARTING_RESOURCES.uzis + STARTING_RESOURCES.aks,
      vehicles: STARTING_RESOURCES.rides,
      drugs:
        STARTING_RESOURCES.hash +
        STARTING_RESOURCES.shrooms +
        STARTING_RESOURCES.coke +
        STARTING_RESOURCES.heroin,
      businesses: 0,
    },
    update: {
      thugs: STARTING_RESOURCES.thugs,
      workers: STARTING_RESOURCES.prostitutes,
      weapons: STARTING_RESOURCES.glocks + STARTING_RESOURCES.uzis + STARTING_RESOURCES.aks,
      vehicles: STARTING_RESOURCES.rides,
      drugs:
        STARTING_RESOURCES.hash +
        STARTING_RESOURCES.shrooms +
        STARTING_RESOURCES.coke +
        STARTING_RESOURCES.heroin,
      businesses: 0,
    },
  });
}

/**
 * Ensure a human player is activated in the current active season.
 * Idempotent — safe on repeated login/refresh.
 */
export async function ensureRoundParticipation(playerId: string): Promise<RoundActivationResult> {
  if (!(await isAdminSchemaReady())) {
    return { activated: false, reason: 'no_season' };
  }

  try {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        user: { select: { email: true } },
        season: true,
        statusExt: true,
      },
    });

    if (!player) return { activated: false, reason: 'no_season' };
    if (!isHumanPlayer({ isSystemPlayer: player.isSystemPlayer, email: player.user?.email })) {
      return { activated: false, reason: 'npc' };
    }
    if (isSeasonEnforcementEnabled() && player.season.status !== 'ACTIVE') {
      return { activated: false, reason: 'season_inactive' };
    }

    const existingActivation = await getPlayerSeasonActivatedAt(playerId);
    if (existingActivation) {
      return { activated: false, reason: 'already_active' };
    }

    const now = new Date();
    const lastSeen = player.statusExt?.lastSeenAt ?? null;

    await prisma.$transaction(async (tx) => {
      await setPlayerSeasonActivatedAt(tx, playerId, now);

      await GameplayAnalyticsService.maybeRecordSessionStart(
        {
          seasonId: player.seasonId,
          playerId,
          lastSeenAt: lastSeen,
          now,
        },
        tx,
      );

      await GameplayAnalyticsService.recordEvent(
        {
          seasonId: player.seasonId,
          playerId,
          eventType: GAMEPLAY_ANALYTICS_EVENTS.ROUND_ACTIVATED,
          metadata: { alias: player.alias },
          isHuman: true,
        },
        tx,
      );
    });

    return { activated: true, firstActivation: true };
  } catch (error) {
    console.error('[round-activation] skipped:', error);
    return { activated: false, reason: 'no_season' };
  }
}
