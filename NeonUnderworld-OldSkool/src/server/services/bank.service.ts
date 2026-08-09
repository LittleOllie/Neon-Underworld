import { prisma } from '@core/lib/db/prisma';
import { NetWorthService } from './net-worth.service';
import { ActivityService } from './activity.service';
import { EmpireService } from './empire.service';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import {
  canUseBank,
  validateBankAmount,
} from '@local/server/domain/empire-calculations';

export type BankTransferResult = {
  cash: number;
  bankCash: number;
  netWorth: number;
  amount: number;
};

async function assertBankAllowed(playerId: string) {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  const restriction = canUseBank(player.lifeStatus, player.travelling);
  if (restriction) {
    throw new Error(restriction);
  }
  return player;
}

export const BankService = {
  async deposit(playerId: string, amount: number): Promise<BankTransferResult> {
    const validationError = validateBankAmount(amount);
    if (validationError) throw new Error(validationError);

    const before = await assertBankAllowed(playerId);
    if (amount > before.cash) {
      throw new Error('Insufficient cash on hand');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      if (amount > current.cash) {
        throw new Error('Insufficient cash on hand');
      }
      return tx.player.update({
        where: { id: playerId },
        data: {
          cash: { decrement: amount },
          bankCash: { increment: amount },
        },
      });
    });

    await EmpireService.syncInventory(playerId);
    const netWorth = NetWorthService.calculateFromPlayer(updated);

    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.BANK_DEPOSIT,
      `Deposited $${amount.toLocaleString()} to bank. Cash: $${updated.cash.toLocaleString()}, Bank: $${updated.bankCash.toLocaleString()}.`,
      { amount, cash: updated.cash, bankCash: updated.bankCash },
    );

    return {
      cash: updated.cash,
      bankCash: updated.bankCash,
      netWorth,
      amount,
    };
  },

  async withdraw(playerId: string, amount: number): Promise<BankTransferResult> {
    const validationError = validateBankAmount(amount);
    if (validationError) throw new Error(validationError);

    const before = await assertBankAllowed(playerId);
    if (amount > before.bankCash) {
      throw new Error('Insufficient bank balance');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      if (amount > current.bankCash) {
        throw new Error('Insufficient bank balance');
      }
      return tx.player.update({
        where: { id: playerId },
        data: {
          bankCash: { decrement: amount },
          cash: { increment: amount },
        },
      });
    });

    await EmpireService.syncInventory(playerId);
    const netWorth = NetWorthService.calculateFromPlayer(updated);

    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.BANK_WITHDRAWAL,
      `Withdrew $${amount.toLocaleString()} from bank. Cash: $${updated.cash.toLocaleString()}, Bank: $${updated.bankCash.toLocaleString()}.`,
      { amount, cash: updated.cash, bankCash: updated.bankCash },
    );

    return {
      cash: updated.cash,
      bankCash: updated.bankCash,
      netWorth,
      amount,
    };
  },
};
