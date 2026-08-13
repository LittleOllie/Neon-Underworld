'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@core/lib/db/prisma';
import { isPlayerAvatarId } from '@core/config/game/player-avatars';
import { auth } from '@local/lib/auth/config';
import { revalidatePlayerGameplayCache } from '@local/server/services/gameplay-cache';
import type { ActionResult } from '@core/server/actions/auth.actions';

export async function setPlayerAvatarAction(avatarId: string): Promise<ActionResult<void>> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) {
    return { success: false, error: 'Not signed in.' };
  }

  if (!isPlayerAvatarId(avatarId)) {
    return { success: false, error: 'Invalid avatar selection.' };
  }

  const player = await prisma.player.update({
    where: { id: playerId },
    data: { avatar: avatarId },
    select: { seasonId: true },
  });

  revalidatePlayerGameplayCache(playerId, player.seasonId);
  revalidatePath('/', 'layout');
  revalidatePath('/identity/select');
  revalidatePath('/settings');
  revalidatePath('/rankings');
  revalidatePath('/command');

  return { success: true, data: undefined };
}
