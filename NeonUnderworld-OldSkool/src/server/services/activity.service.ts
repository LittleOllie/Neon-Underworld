import { prisma } from '@core/lib/db/prisma';
import type { ActivityItem } from '@local/domain/player.model';
import { EMPIRE_ACTIVITY_CATEGORY_SET } from '@local/config/empire-rules';
import {
  ACTIVITY_TYPES,
  normalizeActivityCategory,
  type ActivityType,
} from '@local/config/activity-types';
import { enforcersLabel, specialistsLabel } from '@local/config/terminology';

export class ActivityFeedError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ActivityFeedError';
    if (cause instanceof Error) this.cause = cause;
  }
}

function toActivityItem(row: {
  id: string;
  category: string;
  message: string;
  createdAt: Date;
}): ActivityItem {
  return {
    id: row.id,
    category: normalizeActivityCategory(String(row.category)),
    message: row.message,
    createdAt: row.createdAt,
  };
}

function isEmpireFeedCategory(category: string): boolean {
  return EMPIRE_ACTIVITY_CATEGORY_SET.has(category);
}

export const ActivityService = {
  async record(
    playerId: string,
    category: ActivityType,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await prisma.activity.create({
      data: {
        playerId,
        category,
        message,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
  },

  async getRecent(playerId: string, limit = 15): Promise<ActivityItem[]> {
    const rows = await prisma.activity.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map(toActivityItem);
  },

  /**
   * Empire feed — fetch recent rows, filter in application layer so legacy categories
   * normalise safely and Prisma enum `in` filters are not required.
   */
  async getEmpireRecent(playerId: string, limit = 12): Promise<ActivityItem[]> {
    try {
      const rows = await prisma.activity.findMany({
        where: { playerId },
        orderBy: { createdAt: 'desc' },
        take: Math.max(limit * 4, 24),
      });

      const seen = new Set<string>();
      const items: ActivityItem[] = [];

      for (const row of rows) {
        if (seen.has(row.id)) continue;
        const item = toActivityItem(row);
        if (!isEmpireFeedCategory(item.category)) continue;
        seen.add(row.id);
        items.push(item);
        if (items.length >= limit) break;
      }

      return items;
    } catch (error) {
      console.error('[ActivityService.getEmpireRecent] failed:', error);
      return [];
    }
  },

  /** Seed activity feed from legacy scout results if empty */
  async ensureFeed(playerId: string): Promise<void> {
    const count = await prisma.activity.count({ where: { playerId } });
    if (count > 0) return;

    const scouts = await prisma.scoutResult.findMany({
      where: { playerId },
      include: { district: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (scouts.length === 0) return;

    await prisma.activity.createMany({
      data: scouts.map((s) => ({
        playerId,
        category: ACTIVITY_TYPES.SCOUT,
        message: `Scouted ${s.district.name}: +${s.prostitutesFound} ${specialistsLabel(s.prostitutesFound).toLowerCase()}, +${s.thugsFound} ${enforcersLabel(s.thugsFound).toLowerCase()}, +$${s.cashEarned.toLocaleString()}`,
        metadata: { scoutResultId: s.id },
      })),
    });
  },
};
