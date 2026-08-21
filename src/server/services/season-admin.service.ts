import { SeasonStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getSeasonRoundDay } from '@/lib/game-engine/npc-progression/round-age';
import { isProgressionNpcAccount } from '@/lib/game-engine/npc-progression/identification';
import { PLAYTEST_NPC_EMAIL_PREFIX } from '@/lib/game-engine/playtest-npc-season';
import { initializePlaytestNpcRoundState } from '@/lib/game-engine/playtest-npc-round-init';
import { resetPlayerRoundState } from '@/server/services/round-activation.service';
import {
  archiveHumanForSeasonEnd,
  archivePlayerInboxForRoundEnd,
  cancelAllActiveMarketListings,
  disbandAllCartelsForNewRound,
} from '@/server/services/round-rollover.service';
import {
  countActivatedHumans,
  getPlayerSeasonActivatedAt,
  listActivatedHumanPlayerIds,
  setPlayerSeasonActivatedAt,
} from '@/lib/db/admin-analytics-db';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';
import { aggregateBusinessNwContext } from '@/server/services/business.service';

async function logAdminAction(
  adminUserId: string,
  action: string,
  metadata: object,
  seasonId?: string,
  targetType?: string,
  targetId?: string,
) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      metadata: seasonId ? { ...metadata, seasonId } : metadata,
    },
  });
}

export type EndRoundPreview = {
  seasonId: string;
  seasonNumber: number;
  seasonName: string;
  activatedHumans: number;
  npcCount: number;
  leaderAlias: string | null;
  leaderNetWorth: number | null;
};

export type StartRoundPreview = {
  nextNumber: number;
  durationDays: number;
  humanAccounts: number;
  willResetHumans: number;
};

export const SeasonAdminService = {
  async getEndRoundPreview(seasonId: string): Promise<EndRoundPreview | null> {
    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) return null;

    const activatedCount = (await countActivatedHumans(seasonId)) ?? 0;
    const activatedIds = await listActivatedHumanPlayerIds(seasonId);

    const [npcCount, humans] = await Promise.all([
      prisma.player.count({
        where: {
          seasonId,
          OR: [
            { isSystemPlayer: true },
            { user: { email: { startsWith: 'playtest-npc+' } } },
            { user: { email: { startsWith: 'dev-pvp+' } } },
          ],
        },
      }),
      activatedIds.length > 0
        ? prisma.player.findMany({
            where: { id: { in: activatedIds }, seasonId },
            include: {
              user: { select: { email: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    let leaderAlias: string | null = null;
    let leaderNetWorth: number | null = null;

    if (humans.length > 0) {
      const bizMap = new Map<string, ReturnType<typeof aggregateBusinessNwContext>>();
      for (const h of humans) {
        const businesses = await prisma.business.findMany({ where: { playerId: h.id } });
        bizMap.set(h.id, aggregateBusinessNwContext(businesses));
      }
      let best = humans[0]!;
      let bestNw = calculateCanonicalNetWorthFromPlayer(best, {
        streetWorkers: best.prostitutes,
        ...bizMap.get(best.id)!,
      });
      for (const h of humans.slice(1)) {
        const nw = calculateCanonicalNetWorthFromPlayer(h, {
          streetWorkers: h.prostitutes,
          ...bizMap.get(h.id)!,
        });
        if (nw > bestNw) {
          best = h;
          bestNw = nw;
        }
      }
      leaderAlias = best.alias;
      leaderNetWorth = bestNw;
    }

    return {
      seasonId: season.id,
      seasonNumber: season.number,
      seasonName: season.name,
      activatedHumans: activatedCount,
      npcCount,
      leaderAlias,
      leaderNetWorth,
    };
  },

  async endRound(adminUserId: string, seasonId: string, confirmation: string): Promise<{ ok: true }> {
    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new Error('Season not found');
    if (season.status === 'ENDED') throw new Error('Season already ended');

    const expected = `END ROUND ${season.number}`;
    if (confirmation.trim().toUpperCase() !== expected) {
      throw new Error(`Type "${expected}" to confirm`);
    }

    const preview = await this.getEndRoundPreview(seasonId);
    if (!preview) throw new Error('Unable to build preview');

    await prisma.$transaction(async (tx) => {
      const activatedIds = await listActivatedHumanPlayerIds(seasonId);
      const humans =
        activatedIds.length > 0
          ? await tx.player.findMany({
              where: { id: { in: activatedIds }, seasonId },
              include: { user: { select: { id: true, email: true } } },
            })
          : [];

      for (const human of humans) {
        const businesses = await tx.business.findMany({ where: { playerId: human.id } });
        const bizCtx = aggregateBusinessNwContext(businesses);
        const finalNetWorth = calculateCanonicalNetWorthFromPlayer(human, {
          streetWorkers: human.prostitutes,
          ...bizCtx,
        });

        await archiveHumanForSeasonEnd(tx, {
          seasonId,
          playerId: human.id,
          userId: human.userId,
          alias: human.alias,
          avatar: human.avatar,
          districtId: human.districtId,
          finalNetWorth,
          finalWorkers: human.prostitutes,
          finalThugs: human.thugs,
          finalBusinesses: human.businesses,
          activatedAt: await getPlayerSeasonActivatedAt(human.id),
        });

        await archivePlayerInboxForRoundEnd(tx, human.id);
      }

      await tx.season.update({
        where: { id: seasonId },
        data: { status: SeasonStatus.ENDED },
      });
    });

    await logAdminAction(adminUserId, 'ROUND_ENDED', preview, seasonId);
    return { ok: true };
  },

  async getStartRoundPreview(durationDays = 7): Promise<StartRoundPreview> {
    const latest = await prisma.season.findFirst({ orderBy: { number: 'desc' } });
    const humanAccounts = await prisma.player.count({
      where: {
        isSystemPlayer: false,
        NOT: {
          OR: [
            { user: { email: { startsWith: 'playtest-npc+' } } },
            { user: { email: { startsWith: 'dev-pvp+' } } },
            { user: { email: { startsWith: 'system+' } } },
          ],
        },
      },
    });

    return {
      nextNumber: (latest?.number ?? 0) + 1,
      durationDays,
      humanAccounts,
      willResetHumans: humanAccounts,
    };
  },

  async startNextRound(
    adminUserId: string,
    confirmation: string,
    durationDays = 7,
  ): Promise<{ seasonId: string; seasonNumber: number }> {
    const preview = await this.getStartRoundPreview(durationDays);
    const expected = `START ROUND ${preview.nextNumber}`;
    if (confirmation.trim().toUpperCase() !== expected) {
      throw new Error(`Type "${expected}" to confirm`);
    }

    const active = await prisma.season.findFirst({ where: { status: SeasonStatus.ACTIVE } });
    if (active) {
      throw new Error(`Season ${active.number} is still ACTIVE. End it first.`);
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const season = await prisma.$transaction(async (tx) => {
      await disbandAllCartelsForNewRound(tx);
      await cancelAllActiveMarketListings(tx);

      const created = await tx.season.create({
        data: {
          number: preview.nextNumber,
          name: `Round ${preview.nextNumber}`,
          status: SeasonStatus.ACTIVE,
          startsAt,
          endsAt,
        },
      });

      const humans = await tx.player.findMany({
        where: {
          isSystemPlayer: false,
          NOT: {
            OR: [
              { user: { email: { startsWith: 'playtest-npc+' } } },
              { user: { email: { startsWith: 'dev-pvp+' } } },
              { user: { email: { startsWith: 'system+' } } },
            ],
          },
        },
        select: { id: true },
      });

      for (const human of humans) {
        await resetPlayerRoundState(tx, human.id, created.id);
      }

      const npcs = await tx.player.findMany({
        where: {
          OR: [
            { user: { email: { startsWith: 'playtest-npc+' } } },
            { user: { email: { startsWith: 'dev-pvp+' } } },
          ],
        },
        include: { user: { select: { email: true } } },
      });

      for (const npc of npcs) {
        await tx.player.update({
          where: { id: npc.id },
          data: { seasonId: created.id },
        });
        await setPlayerSeasonActivatedAt(tx, npc.id, new Date());

        if (npc.user.email.startsWith(PLAYTEST_NPC_EMAIL_PREFIX)) {
          await initializePlaytestNpcRoundState(tx, {
            playerId: npc.id,
            districtId: npc.districtId,
            seasonId: created.id,
            aliasNormalized: npc.aliasNormalized,
            roundDay: 1,
          });
        } else if (isProgressionNpcAccount({ isSystemPlayer: npc.isSystemPlayer, email: npc.user.email })) {
          await tx.npcProgressionState.upsert({
            where: { playerId: npc.id },
            create: {
              playerId: npc.id,
              archetype: 'STREET_HUSTLER',
              growthSeed: 1,
              ladderSlot: 0,
              lastProgressedDay: 1,
              lastProgressedAt: new Date(),
            },
            update: {
              lastProgressedDay: 1,
              lastProgressedAt: new Date(),
            },
          });
        }
      }

      return created;
    });

    await logAdminAction(
      adminUserId,
      'ROUND_STARTED',
      { ...preview, seasonId: season.id },
      season.id,
    );

    return { seasonId: season.id, seasonNumber: season.number };
  },

  async listRoundHistory() {
    return prisma.season.findMany({
      orderBy: { number: 'desc' },
    });
  },

  async getRoundDay(seasonId: string): Promise<number> {
    const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
    return getSeasonRoundDay(season.startsAt, season.endsAt);
  },
};
