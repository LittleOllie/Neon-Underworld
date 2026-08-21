import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { isAdminSchemaReady } from '@/lib/db/admin-schema-readiness';

type EventCountRow = { eventType: string; count: number };

/** Raw SQL analytics — works when admin tables exist but Prisma schema is production-safe. */
export async function groupGameplayEventsByType(
  seasonId: string,
  options?: { since?: Date; playerId?: string },
): Promise<EventCountRow[]> {
  if (!(await isAdminSchemaReady())) return [];
  try {
    const since = options?.since;
    const playerId = options?.playerId;
    const rows = await prisma.$queryRaw<Array<{ eventType: string; count: bigint }>>(
      Prisma.sql`
        SELECT "eventType", COUNT(*)::bigint AS count
        FROM "GameplayEvent"
        WHERE "seasonId" = ${seasonId}
        ${since ? Prisma.sql`AND "createdAt" >= ${since}` : Prisma.empty}
        ${playerId ? Prisma.sql`AND "playerId" = ${playerId}` : Prisma.empty}
        GROUP BY "eventType"
      `,
    );
    return rows.map((row) => ({ eventType: row.eventType, count: Number(row.count) }));
  } catch {
    return [];
  }
}

export async function countGameplayEvents(
  seasonId: string,
  eventType: string,
  playerId?: string,
): Promise<number> {
  if (!(await isAdminSchemaReady())) return 0;
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(
      playerId
        ? Prisma.sql`
            SELECT COUNT(*)::bigint AS count
            FROM "GameplayEvent"
            WHERE "seasonId" = ${seasonId}
              AND "eventType" = ${eventType}
              AND "playerId" = ${playerId}
          `
        : Prisma.sql`
            SELECT COUNT(*)::bigint AS count
            FROM "GameplayEvent"
            WHERE "seasonId" = ${seasonId}
              AND "eventType" = ${eventType}
          `,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function listActivatedHumanPlayerIds(seasonId: string): Promise<string[]> {
  if (!(await isAdminSchemaReady())) return [];
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM "Player" p
      INNER JOIN "User" u ON u.id = p."userId"
      WHERE p."seasonId" = ${seasonId}
        AND p."isSystemPlayer" = false
        AND p."seasonActivatedAt" IS NOT NULL
        AND u.email NOT LIKE 'system+%'
        AND u.email NOT LIKE 'playtest-npc+%'
        AND u.email NOT LIKE 'dev-pvp+%'
    `;
    return rows.map((row) => row.id);
  } catch {
    return [];
  }
}

export async function countActivatedHumans(seasonId: string): Promise<number | null> {
  if (!(await isAdminSchemaReady())) return null;
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "Player" p
      INNER JOIN "User" u ON u.id = p."userId"
      WHERE p."seasonId" = ${seasonId}
        AND p."isSystemPlayer" = false
        AND p."seasonActivatedAt" IS NOT NULL
        AND u.email NOT LIKE 'system+%'
        AND u.email NOT LIKE 'playtest-npc+%'
        AND u.email NOT LIKE 'dev-pvp+%'
    `;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

export async function countNewActivationsToday(seasonId: string, dayStart: Date): Promise<number | null> {
  if (!(await isAdminSchemaReady())) return null;
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "Player" p
      INNER JOIN "User" u ON u.id = p."userId"
      WHERE p."seasonId" = ${seasonId}
        AND p."isSystemPlayer" = false
        AND p."seasonActivatedAt" >= ${dayStart}
        AND u.email NOT LIKE 'system+%'
        AND u.email NOT LIKE 'playtest-npc+%'
        AND u.email NOT LIKE 'dev-pvp+%'
    `;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

export async function listRecentGameplayEvents(
  playerId: string,
  limit = 30,
): Promise<Array<{ id: string; eventType: string; metadata: unknown; createdAt: Date }>> {
  if (!(await isAdminSchemaReady())) return [];
  try {
    return await prisma.$queryRaw`
      SELECT id, "eventType", metadata, "createdAt"
      FROM "GameplayEvent"
      WHERE "playerId" = ${playerId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;
  } catch {
    return [];
  }
}

export async function listPlayerDailySnapshots(playerId: string) {
  if (!(await isAdminSchemaReady())) return [];
  try {
    return await prisma.$queryRaw<
      Array<{
        id: string;
        roundDay: number;
        netWorth: number;
        workers: number;
        thugs: number;
        createdAt: Date;
      }>
    >`
      SELECT id, "roundDay", "netWorth", workers, thugs, "createdAt"
      FROM "PlayerDailySnapshot"
      WHERE "playerId" = ${playerId}
      ORDER BY "roundDay" ASC
    `;
  } catch {
    return [];
  }
}

export async function listPlayerSeasonArchives(playerId: string, limit = 10) {
  if (!(await isAdminSchemaReady())) return [];
  try {
    return await prisma.$queryRaw<
      Array<{
        id: string;
        seasonId: string;
        alias: string;
        finalRank: number | null;
        finalNetWorth: number;
        finalWorkers: number;
        finalThugs: number;
        archivedAt: Date;
      }>
    >`
      SELECT id, "seasonId", alias, "finalRank", "finalNetWorth", "finalWorkers", "finalThugs", "archivedAt"
      FROM "PlayerSeasonArchive"
      WHERE "playerId" = ${playerId}
      ORDER BY "archivedAt" DESC
      LIMIT ${limit}
    `;
  } catch {
    return [];
  }
}

export async function listSeasonDailySnapshots(seasonId: string) {
  if (!(await isAdminSchemaReady())) return [];
  try {
    return await prisma.$queryRaw<
      Array<{ roundDay: number; netWorth: number }>
    >`
      SELECT "roundDay", "netWorth"
      FROM "PlayerDailySnapshot"
      WHERE "seasonId" = ${seasonId}
      ORDER BY "roundDay" ASC
    `;
  } catch {
    return [];
  }
}

export async function getPlayerSeasonActivatedAt(playerId: string): Promise<Date | null> {
  if (!(await isAdminSchemaReady())) return null;
  try {
    const rows = await prisma.$queryRaw<Array<{ seasonActivatedAt: Date | null }>>`
      SELECT "seasonActivatedAt"
      FROM "Player"
      WHERE id = ${playerId}
    `;
    return rows[0]?.seasonActivatedAt ?? null;
  } catch {
    return null;
  }
}

export async function setPlayerSeasonActivatedAt(
  tx: Prisma.TransactionClient | typeof prisma,
  playerId: string,
  at: Date,
): Promise<void> {
  if (!(await isAdminSchemaReady())) return;
  try {
    await tx.$executeRaw`
      UPDATE "Player"
      SET "seasonActivatedAt" = ${at}
      WHERE id = ${playerId}
    `;
  } catch {
    /* non-fatal */
  }
}

export async function clearPlayerSeasonActivatedAt(
  tx: Prisma.TransactionClient | typeof prisma,
  playerId: string,
): Promise<void> {
  if (!(await isAdminSchemaReady())) return;
  try {
    await tx.$executeRaw`
      UPDATE "Player"
      SET "seasonActivatedAt" = NULL
      WHERE id = ${playerId}
    `;
  } catch {
    /* non-fatal */
  }
}

export async function recordGameplayEventRaw(input: {
  seasonId: string;
  playerId: string;
  eventType: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  if (!(await isAdminSchemaReady())) return;
  try {
    const metadata = JSON.stringify(input.metadata ?? {});
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "GameplayEvent" ("id", "seasonId", "playerId", "eventType", "metadata", "createdAt")
      VALUES (${id}, ${input.seasonId}, ${input.playerId}, ${input.eventType}, ${metadata}::jsonb, NOW())
    `;
  } catch {
    /* analytics must never break gameplay */
  }
}

export async function upsertPlayerSeasonArchiveRaw(
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
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
  },
): Promise<void> {
  try {
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "PlayerSeasonArchive" (
        "id", "seasonId", "playerId", "userId", "alias", "avatar", "districtId",
        "finalNetWorth", "finalWorkers", "finalThugs", "finalBusinesses", "activatedAt", "archivedAt"
      )
      VALUES (
        ${id},
        ${input.seasonId},
        ${input.playerId},
        ${input.userId},
        ${input.alias},
        ${input.avatar},
        ${input.districtId},
        ${input.finalNetWorth},
        ${input.finalWorkers},
        ${input.finalThugs},
        ${input.finalBusinesses},
        ${input.activatedAt},
        NOW()
      )
      ON CONFLICT ("seasonId", "playerId") DO UPDATE SET
        "finalNetWorth" = EXCLUDED."finalNetWorth",
        "finalWorkers" = EXCLUDED."finalWorkers",
        "finalThugs" = EXCLUDED."finalThugs",
        "finalBusinesses" = EXCLUDED."finalBusinesses",
        "activatedAt" = EXCLUDED."activatedAt",
        "archivedAt" = NOW()
    `;
  } catch {
    /* archive optional when migration not applied */
  }
}
