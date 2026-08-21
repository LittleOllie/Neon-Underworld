import type { Prisma } from '@prisma/client';
import { isHumanPlayer } from '@/lib/game-engine/human-player';
import type { GameplayAnalyticsEventType } from '@/config/game/analytics-events';
import { GAMEPLAY_ANALYTICS_EVENTS, SESSION_GAP_MS } from '@/config/game/analytics-events';
import { recordGameplayEventRaw } from '@/lib/db/admin-analytics-db';
import { prisma } from '@/lib/db/prisma';

export type GameplayEventMetadata = Record<string, string | number | boolean | null>;

type Tx = Prisma.TransactionClient;

export const GameplayAnalyticsService = {
  async recordEvent(
    input: {
      seasonId: string;
      playerId: string;
      eventType: GameplayAnalyticsEventType;
      metadata?: GameplayEventMetadata;
      isHuman?: boolean;
    },
    _tx?: Tx,
  ): Promise<void> {
    if (input.isHuman === false) return;

    if (input.isHuman == null) {
      const player = await prisma.player.findUnique({
        where: { id: input.playerId },
        select: { isSystemPlayer: true, user: { select: { email: true } } },
      });
      if (!player || !isHumanPlayer({ isSystemPlayer: player.isSystemPlayer, email: player.user?.email })) {
        return;
      }
    }

    await recordGameplayEventRaw({
      seasonId: input.seasonId,
      playerId: input.playerId,
      eventType: input.eventType,
      metadata: input.metadata,
    });
  },

  async maybeRecordSessionStart(
    input: {
      seasonId: string;
      playerId: string;
      lastSeenAt: Date | null;
      now?: Date;
    },
    _tx?: Tx,
  ): Promise<void> {
    const now = input.now ?? new Date();
    if (input.lastSeenAt && now.getTime() - input.lastSeenAt.getTime() < SESSION_GAP_MS) {
      return;
    }

    await this.recordEvent(
      {
        seasonId: input.seasonId,
        playerId: input.playerId,
        eventType: GAMEPLAY_ANALYTICS_EVENTS.PLAYER_SESSION_STARTED,
        isHuman: true,
      },
      _tx,
    );
  },

  async countEventsSince(
    seasonId: string,
    eventType: GameplayAnalyticsEventType,
    since: Date,
  ): Promise<number> {
    const { countGameplayEvents } = await import('@/lib/db/admin-analytics-db');
    const rows = await import('@/lib/db/admin-analytics-db').then((m) =>
      m.groupGameplayEventsByType(seasonId, { since }),
    );
    return rows.find((r) => r.eventType === eventType)?.count ?? 0;
  },

  async countPlayerEvents(
    playerId: string,
    seasonId: string,
    eventTypes?: GameplayAnalyticsEventType[],
  ): Promise<number> {
    const { countGameplayEvents } = await import('@/lib/db/admin-analytics-db');
    if (!eventTypes?.length) {
      const rows = await import('@/lib/db/admin-analytics-db').then((m) =>
        m.groupGameplayEventsByType(seasonId, { playerId }),
      );
      return rows.reduce((sum, row) => sum + row.count, 0);
    }
    let total = 0;
    for (const eventType of eventTypes) {
      total += await countGameplayEvents(seasonId, eventType, playerId);
    }
    return total;
  },
};
