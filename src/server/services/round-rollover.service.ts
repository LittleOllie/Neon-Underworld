import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { isAdminSchemaReady } from '@/lib/db/admin-schema-readiness';
import { upsertPlayerSeasonArchiveRaw } from '@/lib/db/admin-analytics-db';

type Tx = Prisma.TransactionClient;

/** Reset inbox/offline counters so a new round starts clean. */
export async function resetPlayerRoundStatusExt(tx: Tx, playerId: string): Promise<void> {
  await tx.playerStatusExt.upsert({
    where: { playerId },
    create: {
      playerId,
      unreadReports: 0,
      offlineDamagingHits: 0,
      offlineProtectionActive: false,
      notification: null,
    },
    update: {
      unreadReports: 0,
      offlineDamagingHits: 0,
      offlineProtectionActive: false,
      notification: null,
    },
  });
}

/** Mark pre-round inbox items read — history stays, but won't pollute new round. */
export async function archivePlayerInboxForRoundEnd(tx: Tx, playerId: string): Promise<void> {
  await tx.report.updateMany({
    where: { playerId, read: false },
    data: { read: true },
  });
  await resetPlayerRoundStatusExt(tx, playerId);
}

/** Disband all cartels — round-specific orgs must not carry into the next round. */
export async function disbandAllCartelsForNewRound(tx: Tx): Promise<number> {
  await tx.player.updateMany({
    where: { cartelId: { not: null } },
    data: { cartelId: null, cartelDonationPercent: 0 },
  });
  await tx.cartelInvite.deleteMany({});
  await tx.cartelJoinRequest.deleteMany({});
  const result = await tx.cartel.deleteMany({});
  return result.count;
}

/** Cancel stray active listings (e.g. NPC/system sellers not reset individually). */
export async function cancelAllActiveMarketListings(tx: Tx): Promise<number> {
  const result = await tx.marketListing.updateMany({
    where: { status: 'ACTIVE' },
    data: { status: 'CANCELLED' },
  });
  return result.count;
}

export type HumanArchiveInput = {
  seasonId: string;
  playerId: string;
  userId: string;
  alias: string;
  avatar: string | null;
  districtId: string;
  finalNetWorth: number;
  finalWorkers: number;
  finalThugs: number;
  finalBusinesses: number;
  activatedAt: Date | null;
};

export async function archiveHumanForSeasonEnd(
  tx: Tx,
  input: HumanArchiveInput,
): Promise<void> {
  if (await isAdminSchemaReady()) {
    await upsertPlayerSeasonArchiveRaw(tx, input);
  }
}

/** Earliest timestamp for per-target attack cap in the current round. */
export function attackCapWindowStart(seasonStartsAt: Date, now = Date.now()): Date {
  const last24h = now - 24 * 60 * 60 * 1000;
  return new Date(Math.max(last24h, seasonStartsAt.getTime()));
}

/** Intel/scout reports from before the current round must not be reused. */
export function isReportFromCurrentRound(reportCreatedAt: Date, seasonStartsAt: Date): boolean {
  return reportCreatedAt.getTime() >= seasonStartsAt.getTime();
}

export async function getPlayerSeasonStartsAt(playerId: string): Promise<Date | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { season: { select: { startsAt: true } } },
  });
  return player?.season.startsAt ?? null;
}
