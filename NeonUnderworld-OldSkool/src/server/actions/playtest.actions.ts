'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@core/lib/db/prisma';
import { TURNS_CONFIG } from '@core/config/game/balance';
import { settleTurnRegeneration } from '@core/lib/game-engine/turns';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';

export type PlaytestTurnGrant = '500' | '1000' | 'fill';

function playtestTurnsEnabled(): boolean {
  return process.env.PLAYTEST_TURNS !== 'false';
}

export async function grantPlaytestTurnsAction(
  grant: PlaytestTurnGrant,
): Promise<ActionResult<{ newTurns: number }>> {
  if (!playtestTurnsEnabled()) {
    return { success: false, error: 'Playtest turn grants are disabled.' };
  }

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  const turnState = await prisma.playerTurnState.findUnique({ where: { playerId } });
  if (!turnState) return { success: false, error: 'Turn state not found' };

  const settled = settleTurnRegeneration({
    currentTurns: turnState.currentTurns,
    lastRegeneratedAt: turnState.lastRegeneratedAt,
    turnCap: turnState.turnCap,
    regenerationRatePerMs: turnState.regenerationRate,
  });

  const added = grant === 'fill' ? TURNS_CONFIG.turnCap : Number(grant);
  const newTurns =
    grant === 'fill'
      ? TURNS_CONFIG.turnCap
      : Math.min(settled.currentTurns + added, TURNS_CONFIG.turnCap);

  await prisma.playerTurnState.update({
    where: { playerId },
    data: {
      currentTurns: newTurns,
      turnCap: TURNS_CONFIG.turnCap,
      regenerationRate: TURNS_CONFIG.regenerationRatePerMs,
    },
  });

  revalidatePath('/', 'layout');
  return { success: true, data: { newTurns } };
}
