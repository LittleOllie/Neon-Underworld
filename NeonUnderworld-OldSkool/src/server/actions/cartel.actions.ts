'use server';

import { CartelService } from '@core/server/services/cartel.service';
import { CARTEL_DONATION_OPTIONS } from '@core/lib/game-engine/cartel-economics';
import { cartelArmouryPurchaseSchema } from '@core/lib/validation/schemas';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { GameplayError, toUserMessage } from '@core/lib/game-engine/gameplay-errors';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';

export type CartelPageData = Awaited<ReturnType<typeof CartelService.getCartelPageForPlayer>> & {
  donationOptions: readonly number[];
};

export async function getCartelPageData(playerId: string): Promise<CartelPageData> {
  const data = await CartelService.getCartelPageForPlayer(playerId);
  return { ...data, donationOptions: CARTEL_DONATION_OPTIONS };
}

export async function createCartelAction(
  name: string,
  tag: string,
): Promise<ActionResult<{ cartelId: string }>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const cartel = await CartelService.createCartel(playerId, name, tag);
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      `You created cartel ${cartel.name} [${cartel.tag}].`,
      { cartelId: cartel.id },
    );
    return { success: true, data: { cartelId: cartel.id } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function inviteToCartelAction(
  inviteeAlias: string,
): Promise<ActionResult<{ inviteId: string }>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const invite = await CartelService.invitePlayer(playerId, inviteeAlias);
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      `You invited ${inviteeAlias} to your cartel.`,
      { inviteId: invite.id },
    );
    return { success: true, data: { inviteId: invite.id } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function acceptCartelInviteAction(
  inviteId: string,
): Promise<ActionResult<{ cartelId: string }>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const cartelId = await CartelService.acceptInvite(playerId, inviteId);
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      'You joined a cartel.',
      { cartelId },
    );
    return { success: true, data: { cartelId } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function declineCartelInviteAction(inviteId: string): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    await CartelService.declineInvite(playerId, inviteId);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function leaveCartelAction(): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    await CartelService.leaveCartel(playerId);
    await ActivityService.record(playerId, ACTIVITY_TYPES.CARTEL, 'You left your cartel.');
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function removeCartelMemberAction(memberId: string): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    await CartelService.removeMember(playerId, memberId);
    await ActivityService.record(playerId, ACTIVITY_TYPES.CARTEL, 'You removed a cartel member.');
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function setCartelDonationAction(
  percent: number,
): Promise<ActionResult<{ percent: number }>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const normalized = await CartelService.setDonationPercent(playerId, percent);
    return { success: true, data: { percent: normalized } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export interface CartelArmouryPurchaseResult {
  item: 'thug' | 'glock' | 'uzi';
  quantity: number;
  unitPrice: number;
  totalCost: number;
  newTreasuryCash: number;
  newOwnedQuantity: number;
  cartelNetWorth: number;
}

export async function purchaseCartelArmouryAction(
  item: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<CartelArmouryPurchaseResult>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const parsed = cartelArmouryPurchaseSchema.safeParse({ item, quantity, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const result = await CartelService.purchaseArmouryItem(
      playerId,
      parsed.data.item,
      parsed.data.quantity,
      parsed.data.idempotencyKey,
    );

    const label =
      item === 'thug' ? 'thugs' : item === 'glock' ? 'glocks' : 'uzis';
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      `Cartel armoury: purchased ${quantity.toLocaleString()} ${label} for $${result.totalCost.toLocaleString()}.`,
      { item, quantity, totalCost: result.totalCost },
    );

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function getCartelRankingsAction() {
  return CartelService.getCartelRankings();
}
