'use server';

import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { BankService, type BankTransferResult } from '@local/server/services/bank.service';
import { prisma } from '@core/lib/db/prisma';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';

export type BankActionResult = WithPlayerShell<BankTransferResult>;

export async function depositAction(amount: number): Promise<ActionResult<BankActionResult>> {
  try {
    const session = await auth();
    if (!session?.user?.playerId) {
      return { success: false, error: 'Not authenticated' };
    }

    const playerId = session.user.playerId;
    const data = await BankService.deposit(playerId, amount);
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { district: true, turnState: true },
    });
    const shell = await finalizeLocalMutationShell(playerId, player, ['/empire', '/command', '/bank'], {
      cash: data.cash,
      netWorth: data.netWorth,
      bankCash: data.bankCash,
    });
    return { success: true, data: { ...data, shell } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Deposit failed',
    };
  }
}

export async function withdrawAction(amount: number): Promise<ActionResult<BankActionResult>> {
  try {
    const session = await auth();
    if (!session?.user?.playerId) {
      return { success: false, error: 'Not authenticated' };
    }

    const playerId = session.user.playerId;
    const data = await BankService.withdraw(playerId, amount);
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { district: true, turnState: true },
    });
    const shell = await finalizeLocalMutationShell(playerId, player, ['/empire', '/command', '/bank'], {
      cash: data.cash,
      netWorth: data.netWorth,
      bankCash: data.bankCash,
    });
    return { success: true, data: { ...data, shell } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Withdrawal failed',
    };
  }
}
