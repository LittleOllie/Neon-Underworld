'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@core/lib/db/prisma';
import { auth } from '@local/lib/auth/config';
import { revalidatePlayerGameplayCache } from '@local/server/services/gameplay-cache';
import type { ActionResult } from '@core/server/actions/auth.actions';

export async function setWireEnabledAction(enabled: boolean): Promise<ActionResult<{ wireEnabled: boolean }>> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) {
    return { success: false, error: 'Not signed in.' };
  }

  if (typeof enabled !== 'boolean') {
    return { success: false, error: 'Invalid setting value.' };
  }

  const player = await prisma.player.update({
    where: { id: playerId },
    data: { wireEnabled: enabled },
    select: { wireEnabled: true, seasonId: true },
  });

  revalidatePlayerGameplayCache(playerId, player.seasonId);
  revalidatePath('/', 'layout');
  revalidatePath('/settings');

  return { success: true, data: { wireEnabled: player.wireEnabled } };
}
