'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { BankService, type BankTransferResult } from '@local/server/services/bank.service';
import { revalidatePlayerGameplayCache } from '@local/server/services/gameplay-cache';
import { prisma } from '@core/lib/db/prisma';

export async function depositAction(amount: number): Promise<ActionResult<BankTransferResult>> {
  try {
    const session = await auth();
    if (!session?.user?.playerId) {
      return { success: false, error: 'Not authenticated' };
    }

    const data = await BankService.deposit(session.user.playerId, amount);
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: session.user.playerId },
      select: { seasonId: true },
    });
    revalidatePlayerGameplayCache(session.user.playerId, player.seasonId);
    revalidatePath('/empire');
    revalidatePath('/command');
    revalidatePath('/bank');
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Deposit failed',
    };
  }
}

export async function withdrawAction(amount: number): Promise<ActionResult<BankTransferResult>> {
  try {
    const session = await auth();
    if (!session?.user?.playerId) {
      return { success: false, error: 'Not authenticated' };
    }

    const data = await BankService.withdraw(session.user.playerId, amount);
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: session.user.playerId },
      select: { seasonId: true },
    });
    revalidatePlayerGameplayCache(session.user.playerId, player.seasonId);
    revalidatePath('/empire');
    revalidatePath('/command');
    revalidatePath('/bank');
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Withdrawal failed',
    };
  }
}
