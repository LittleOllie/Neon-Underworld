'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { payoutSchema } from '@/lib/validation/schemas';
import {
  calculateProstituteHappiness,
} from '@/lib/game-engine/happiness';
import { snapshotPlayerState } from '@/lib/game-engine/state';
import { toUserMessage } from '@/lib/game-engine/errors';
import type { ActionResult } from './auth.actions';

export async function updatePayoutAction(
  payoutPercent: number,
): Promise<ActionResult<{ payoutPercent: number; prostituteHappiness: number }>> {
  try {
    const session = await requirePlayer();
    const parsed = payoutSchema.safeParse({ payoutPercent });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payout' };
    }

    const playerId = session.user.playerId!;

    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    const before = snapshotPlayerState(player);

    const prostituteHappiness = calculateProstituteHappiness({
      prostitutes: player.prostitutes,
      thugs: player.thugs,
      hash: player.hash,
      condoms: player.condoms,
      prostitutePayoutPercent: parsed.data.payoutPercent,
    }).score;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.player.update({
        where: { id: playerId },
        data: {
          prostitutePayoutPercent: parsed.data.payoutPercent,
          prostituteHappiness,
        },
      });

      await tx.economicAuditLog.create({
        data: {
          playerId,
          userId: session.user.id,
          eventType: 'PAYOUT_UPDATE',
          source: 'empire',
          beforeState: before as object,
          delta: { prostitutePayoutPercent: parsed.data.payoutPercent - player.prostitutePayoutPercent },
          afterState: snapshotPlayerState(result) as object,
        },
      });

      return result;
    });

    return {
      success: true,
      data: {
        payoutPercent: updated.prostitutePayoutPercent,
        prostituteHappiness: updated.prostituteHappiness,
      },
    };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}
