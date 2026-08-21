'use server';

import { CartelService } from '@core/server/services/cartel.service';
import { CARTEL_DONATION_OPTIONS } from '@core/lib/game-engine/cartel-economics';
import { cartelArmouryPurchaseSchema } from '@core/lib/validation/schemas';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { requireSessionPlayerId, assertSessionMatchesPlayer } from '@local/lib/auth/session-player';
import { GameplayError, toUserMessage } from '@core/lib/game-engine/gameplay-errors';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { OS_TERMS } from '@local/config/terminology';
import { ActivityService } from '@local/server/services/activity.service';
import { prisma } from '@core/lib/db/prisma';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { PlayerShellSnapshot } from '@local/domain/player-shell.model';
import {
  recordPostGameplayAnalytics,
  GAMEPLAY_ANALYTICS_EVENTS,
} from '@local/server/services/gameplay-analytics-hook';

export type CartelPageData = Awaited<ReturnType<typeof CartelService.getCartelPageForPlayer>> & {
  donationOptions: readonly number[];
};

export type CartelMutationResult<T = Record<string, never>> = (T extends void ? {} : T) & {
  page: CartelPageData;
  shell: PlayerShellSnapshot;
};

async function finalizeCartelMutation(
  playerId: string,
): Promise<{ page: CartelPageData; shell: PlayerShellSnapshot }> {
  const updated = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { district: true, turnState: true },
  });
  const shell = await finalizeLocalMutationShell(playerId, updated, ['/cartels']);
  const page = await loadCartelPage(playerId);
  return { page, shell };
}

async function loadCartelPage(playerId: string): Promise<CartelPageData> {
  const data = await CartelService.getCartelPageForPlayer(playerId);
  return { ...data, donationOptions: CARTEL_DONATION_OPTIONS };
}

export async function getCartelPageData(): Promise<CartelPageData> {
  const playerId = await requireSessionPlayerId();
  return loadCartelPage(playerId);
}

export async function createCartelAction(
  name: string,
  tag: string,
): Promise<ActionResult<CartelMutationResult<{ cartelId: string }>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const cartel = await CartelService.createCartel(playerId, name, tag);
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    await recordPostGameplayAnalytics(player, GAMEPLAY_ANALYTICS_EVENTS.CARTEL_CREATED, {
      cartelId: cartel.id,
      name: cartel.name,
      tag: cartel.tag,
    });
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      `You created ${OS_TERMS.faction.toLowerCase()} ${cartel.name} [${cartel.tag}].`,
      { cartelId: cartel.id },
    );
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { cartelId: cartel.id, page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function inviteToCartelAction(
  inviteeAlias: string,
): Promise<ActionResult<CartelMutationResult<{ inviteId: string }>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const invite = await CartelService.invitePlayer(playerId, inviteeAlias);
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      `You invited ${inviteeAlias} to your ${OS_TERMS.faction.toLowerCase()}.`,
      { inviteId: invite.id },
    );
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { inviteId: invite.id, page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function requestCartelJoinAction(
  cartelId: string,
): Promise<ActionResult<CartelMutationResult<{ requestId: string }>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const request = await CartelService.requestToJoin(playerId, cartelId);
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      `You requested to join a ${OS_TERMS.faction.toLowerCase()}.`,
      { cartelId, requestId: request.id },
    );
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { requestId: request.id, page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function acceptCartelJoinRequestAction(
  requestId: string,
): Promise<ActionResult<CartelMutationResult<{ cartelId: string; memberAlias: string }>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const pending = await prisma.cartelJoinRequest.findUnique({
      where: { id: requestId },
      include: { applicant: { select: { alias: true } } },
    });
    if (!pending) throw new GameplayError('CARTEL_JOIN_REQUEST_INVALID');

    const cartelId = await CartelService.acceptJoinRequest(playerId, requestId);
    const memberAlias = pending.applicant.alias;
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      `You accepted ${memberAlias} into your ${OS_TERMS.faction.toLowerCase()}.`,
      { cartelId, requestId },
    );
    await ActivityService.record(
      pending.applicantId,
      ACTIVITY_TYPES.CARTEL,
      `You joined a ${OS_TERMS.faction.toLowerCase()}.`,
      { cartelId },
    );
    const applicant = await prisma.player.findUniqueOrThrow({ where: { id: pending.applicantId } });
    await recordPostGameplayAnalytics(applicant, GAMEPLAY_ANALYTICS_EVENTS.CARTEL_JOINED, { cartelId });
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { cartelId, memberAlias, page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function declineCartelJoinRequestAction(
  requestId: string,
): Promise<ActionResult<CartelMutationResult<void>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    await CartelService.declineJoinRequest(playerId, requestId);
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function acceptCartelInviteAction(
  inviteId: string,
): Promise<ActionResult<CartelMutationResult<{ cartelId: string }>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const cartelId = await CartelService.acceptInvite(playerId, inviteId);
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    await recordPostGameplayAnalytics(player, GAMEPLAY_ANALYTICS_EVENTS.CARTEL_JOINED, { cartelId });
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      `You joined a ${OS_TERMS.faction.toLowerCase()}.`,
      { cartelId },
    );
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { cartelId, page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function declineCartelInviteAction(
  inviteId: string,
): Promise<ActionResult<CartelMutationResult<void>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    await CartelService.declineInvite(playerId, inviteId);
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function leaveCartelAction(): Promise<ActionResult<CartelMutationResult<void>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    await CartelService.leaveCartel(playerId);
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    await recordPostGameplayAnalytics(player, GAMEPLAY_ANALYTICS_EVENTS.CARTEL_LEFT, {});
    await ActivityService.record(playerId, ACTIVITY_TYPES.CARTEL, `You left your ${OS_TERMS.faction.toLowerCase()}.`);
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function removeCartelMemberAction(
  memberId: string,
): Promise<ActionResult<CartelMutationResult<void>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    await CartelService.removeMember(playerId, memberId);
    await ActivityService.record(playerId, ACTIVITY_TYPES.CARTEL, `You removed a ${OS_TERMS.faction.toLowerCase()} member.`);
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function transferCartelLeadershipAction(
  newLeaderId: string,
): Promise<ActionResult<CartelMutationResult<{ newLeaderAlias: string }>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const target = await prisma.player.findUnique({
      where: { id: newLeaderId },
      select: { alias: true },
    });
    if (!target) throw new GameplayError('CARTEL_NOT_MEMBER');

    await CartelService.transferLeadership(playerId, newLeaderId);
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      `You transferred ${OS_TERMS.faction.toLowerCase()} leadership to ${target.alias}.`,
      { newLeaderId },
    );
    await ActivityService.record(
      newLeaderId,
      ACTIVITY_TYPES.CARTEL,
      `You are now the ${OS_TERMS.faction.toLowerCase()} leader.`,
      { previousLeaderId: playerId },
    );
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { newLeaderAlias: target.alias, page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function setCartelDonationAction(
  percent: number,
): Promise<ActionResult<CartelMutationResult<{ percent: number }>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const normalized = await CartelService.setDonationPercent(playerId, percent);
    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { percent: normalized, page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export interface CartelArmouryPurchaseResult {
  item: 'thug' | 'glock' | 'uzi' | 'ride';
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
): Promise<ActionResult<CartelMutationResult<CartelArmouryPurchaseResult>>> {
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
      item === 'thug'
        ? 'thugs'
        : item === 'glock'
          ? 'glocks'
          : item === 'uzi'
            ? 'uzis'
            : 'rides';
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.CARTEL,
      `${OS_TERMS.faction} armoury: purchased ${quantity.toLocaleString()} ${label} for $${result.totalCost.toLocaleString()}.`,
      { item, quantity, totalCost: result.totalCost },
    );

    const { page, shell } = await finalizeCartelMutation(playerId);
    return { success: true, data: { ...result, page, shell } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function getCartelRankingsAction() {
  return CartelService.getCartelRankings();
}
