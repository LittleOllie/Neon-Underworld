'use server';

import { revalidatePath } from 'next/cache';
import { PlayerAvatarSource } from '@prisma/client';
import { prisma } from '@core/lib/db/prisma';
import { isPlayerAvatarId } from '@core/config/game/player-avatars';
import { auth } from '@local/lib/auth/config';
import { revalidatePlayerGameplayCache } from '@local/server/services/gameplay-cache';
import { normalizeHexColor } from '@core/lib/game-engine/theme-safety';
import type { ActionResult } from '@core/server/actions/auth.actions';

export type PlayerIdentityInput =
  | {
      source: 'CHARACTER';
      avatarId: string;
      themePrimary?: string | null;
      themeSecondary?: string | null;
      useCharacterTheme?: boolean;
    }
  | {
      source: 'UPLOAD';
      pfpUrl: string;
      themePrimary: string;
      themeSecondary: string;
    };

export async function setPlayerIdentityAction(
  input: PlayerIdentityInput,
): Promise<ActionResult<void>> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) {
    return { success: false, error: 'Not signed in.' };
  }

  if (input.source === 'CHARACTER') {
    if (!isPlayerAvatarId(input.avatarId)) {
      return { success: false, error: 'Invalid character selection.' };
    }

    const useCharacterTheme = input.useCharacterTheme !== false;
    const themePrimary = useCharacterTheme
      ? null
      : normalizeHexColor(input.themePrimary ?? '');
    const themeSecondary = useCharacterTheme
      ? null
      : normalizeHexColor(input.themeSecondary ?? '');

    if (!useCharacterTheme && (!themePrimary || !themeSecondary)) {
      return { success: false, error: 'Choose valid primary and secondary colours.' };
    }

    const player = await prisma.player.update({
      where: { id: playerId },
      data: {
        avatarSource: PlayerAvatarSource.CHARACTER,
        avatar: input.avatarId,
        pfpUrl: null,
        themePrimary,
        themeSecondary,
      },
      select: { seasonId: true },
    });

    revalidatePlayerGameplayCache(playerId, player.seasonId);
    revalidateIdentityPaths();
    return { success: true, data: undefined };
  }

  if (!input.pfpUrl.startsWith('/') && !input.pfpUrl.startsWith('https://')) {
    return { success: false, error: 'Invalid profile image.' };
  }

  const themePrimary = normalizeHexColor(input.themePrimary);
  const themeSecondary = normalizeHexColor(input.themeSecondary);
  if (!themePrimary || !themeSecondary) {
    return { success: false, error: 'Choose valid primary and secondary colours.' };
  }

  const player = await prisma.player.update({
    where: { id: playerId },
    data: {
      avatarSource: PlayerAvatarSource.UPLOAD,
      avatar: null,
      pfpUrl: input.pfpUrl,
      themePrimary,
      themeSecondary,
    },
    select: { seasonId: true },
  });

  revalidatePlayerGameplayCache(playerId, player.seasonId);
  revalidateIdentityPaths();
  return { success: true, data: undefined };
}

/** @deprecated Use setPlayerIdentityAction */
export async function setPlayerAvatarAction(avatarId: string): Promise<ActionResult<void>> {
  return setPlayerIdentityAction({
    source: 'CHARACTER',
    avatarId,
    useCharacterTheme: true,
  });
}

export async function resetPlayerThemeAction(): Promise<ActionResult<void>> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) {
    return { success: false, error: 'Not signed in.' };
  }

  const player = await prisma.player.update({
    where: { id: playerId },
    data: {
      themePrimary: null,
      themeSecondary: null,
    },
    select: { seasonId: true },
  });

  revalidatePlayerGameplayCache(playerId, player.seasonId);
  revalidateIdentityPaths();
  return { success: true, data: undefined };
}

function revalidateIdentityPaths() {
  revalidatePath('/', 'layout');
  revalidatePath('/identity/select');
  revalidatePath('/settings');
  revalidatePath('/rankings');
  revalidatePath('/command');
}
