import { prisma } from '@core/lib/db/prisma';

export interface PendingCartelInviteSummary {
  id: string;
  cartelName: string;
}

export async function getPendingCartelInvites(
  playerId: string,
  limit = 3,
): Promise<PendingCartelInviteSummary[]> {
  const rows = await prisma.cartelInvite.findMany({
    where: {
      inviteeId: playerId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    include: { cartel: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    cartelName: row.cartel.name,
  }));
}
