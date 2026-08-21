import { prisma } from '@/lib/db/prisma';

let cachedReady: boolean | null = null;

/** True when admin/round migration has been applied (Player.seasonActivatedAt exists). */
export async function isAdminSchemaReady(): Promise<boolean> {
  if (cachedReady !== null) return cachedReady;
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Player'
          AND column_name = 'seasonActivatedAt'
      ) AS "exists"
    `;
    cachedReady = Boolean(rows[0]?.exists);
  } catch {
    cachedReady = false;
  }
  return cachedReady;
}

export function resetAdminSchemaReadinessCache(): void {
  cachedReady = null;
}

/** Rankings/PvP filter — only when admin migration is applied. */
export async function humanRoundParticipationWhere(): Promise<
  { seasonActivatedAt: { not: null } } | Record<string, never>
> {
  if (await isAdminSchemaReady()) {
    return { seasonActivatedAt: { not: null } };
  }
  return {};
}
