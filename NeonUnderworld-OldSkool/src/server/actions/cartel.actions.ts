'use server';

import { CartelService } from '@core/server/services/cartel.service';
import { CARTEL_DONATION_OPTIONS } from '@core/lib/game-engine/cartel-economics';
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

export async function getCartelRankingsAction() {
  return CartelService.getCartelRankings();
}
