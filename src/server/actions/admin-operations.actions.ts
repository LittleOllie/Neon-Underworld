'use server';

import { requireAdmin } from '@/lib/auth/session';
import { toUserMessage } from '@/lib/game-engine/errors';
import type { ActionResult } from '@/server/actions/auth.actions';
import { AdminDashboardService } from '@/server/services/admin-dashboard.service';
import { AdminTurnGrantService } from '@/server/services/admin-turn-grant.service';
import { SeasonAdminService } from '@/server/services/season-admin.service';
import { prisma } from '@/lib/db/prisma';

async function assertAdminSession() {
  const session = await requireAdmin();
  return session;
}

export async function getAdminOverviewAction() {
  await assertAdminSession();
  return AdminDashboardService.getOverview();
}

export async function getAdminPlayersAction(input: {
  search?: string;
  districtSlug?: string;
  activatedOnly?: boolean;
  sort?: 'nw' | 'activity' | 'alias';
  page?: number;
}) {
  await assertAdminSession();
  const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' }, orderBy: { number: 'desc' } });
  if (!season) return { total: 0, page: 1, pageSize: 25, rows: [], season: null };
  const result = await AdminDashboardService.listPlayers({ ...input, seasonId: season.id });
  return { ...result, season: { id: season.id, number: season.number, name: season.name } };
}

export async function getAdminPlayerDetailAction(playerId: string) {
  await assertAdminSession();
  return AdminDashboardService.getPlayerDetail(playerId);
}

export async function getAdminAnalyticsAction(seasonId?: string) {
  await assertAdminSession();
  const season =
    seasonId != null
      ? await prisma.season.findUnique({ where: { id: seasonId } })
      : await prisma.season.findFirst({ where: { status: 'ACTIVE' }, orderBy: { number: 'desc' } });
  if (!season) return null;
  return AdminDashboardService.getSeasonAnalytics(season.id);
}

export async function getAdminRoundsAction() {
  await assertAdminSession();
  return SeasonAdminService.listRoundHistory();
}

export async function getEndRoundPreviewAction(seasonId: string) {
  await assertAdminSession();
  return SeasonAdminService.getEndRoundPreview(seasonId);
}

export async function getStartRoundPreviewAction(durationDays = 7) {
  await assertAdminSession();
  return SeasonAdminService.getStartRoundPreview(durationDays);
}

export async function endRoundAction(
  seasonId: string,
  confirmation: string,
): Promise<ActionResult> {
  try {
    const session = await assertAdminSession();
    await SeasonAdminService.endRound(session.user.id, seasonId, confirmation);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function startNextRoundAction(
  confirmation: string,
  durationDays = 7,
): Promise<ActionResult<{ seasonId: string; seasonNumber: number }>> {
  try {
    const session = await assertAdminSession();
    const result = await SeasonAdminService.startNextRound(session.user.id, confirmation, durationDays);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function previewBulkTurnGrantAction(): Promise<ActionResult<{ affectedCount: number }>> {
  try {
    await assertAdminSession();
    const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' }, orderBy: { number: 'desc' } });
    if (!season) return { success: false, error: 'No active season' };
    const preview = await AdminTurnGrantService.previewBulkGrant(season.id);
    return { success: true, data: preview };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function grantTurnsToPlayerAction(
  playerId: string,
  amount: number,
  reason: string,
): Promise<ActionResult<{ newTurns: number; playerAlias: string }>> {
  try {
    const session = await assertAdminSession();
    const result = await AdminTurnGrantService.grantToPlayer(session.user.id, playerId, amount, reason);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function grantBulkTurnsAction(
  amount: number,
  reason: string,
  confirmation: string,
): Promise<ActionResult<{ affectedCount: number }>> {
  try {
    const session = await assertAdminSession();
    const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' }, orderBy: { number: 'desc' } });
    if (!season) return { success: false, error: 'No active season' };
    const result = await AdminTurnGrantService.grantBulkToActiveHumans(
      session.user.id,
      season.id,
      amount,
      reason,
      confirmation,
    );
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}
