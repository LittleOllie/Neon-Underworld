import { GameplayAnalyticsService } from '@core/server/services/gameplay-analytics.service';
import type { GameplayAnalyticsEventType } from '@core/config/game/analytics-events';
import type { PlayerNetWorthRecord } from '@local/server/services/net-worth.service';

/** Record analytics after successful human gameplay — never throws. */
export async function recordPostGameplayAnalytics(
  player: PlayerNetWorthRecord & {
    id: string;
    seasonId: string;
    prostitutes?: number;
    thugs?: number;
    districtId?: string;
    turnState?: { currentTurns: number } | null;
    season?: { startsAt: Date; endsAt: Date } | null;
  },
  eventType: GameplayAnalyticsEventType,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await GameplayAnalyticsService.recordEvent({
      seasonId: player.seasonId,
      playerId: player.id,
      eventType,
      metadata,
    });
  } catch (error) {
    console.error('Analytics recording failed (non-fatal):', error);
  }
}

export { GAMEPLAY_ANALYTICS_EVENTS } from '@core/config/game/analytics-events';
