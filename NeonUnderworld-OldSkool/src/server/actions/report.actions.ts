'use server';

import { auth } from '@local/lib/auth/config';
import { ReportService, type ReportListItem } from '@local/server/services/report.service';

export async function markReportReadAction(
  reportId: string,
): Promise<{ ok: boolean; unreadReports?: number }> {
  const session = await auth();
  if (!session?.user?.playerId) return { ok: false };
  const unreadReports = await ReportService.markRead(reportId, session.user.playerId);
  return { ok: unreadReports != null, unreadReports: unreadReports ?? undefined };
}

export async function loadMoreReportsAction(
  filter: 'all' | 'unread',
  offset: number,
): Promise<{ items: ReportListItem[]; hasMore: boolean } | { error: string }> {
  const session = await auth();
  if (!session?.user?.playerId) {
    return { error: 'Not authenticated.' };
  }
  try {
    return await ReportService.listFiltered(session.user.playerId, filter, {
      limit: 25,
      offset: Math.max(0, offset),
    });
  } catch {
    return { error: 'Could not load more reports.' };
  }
}

export async function markAllReportsReadAction(): Promise<
  { success: true; count: number; unreadReports: number } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.playerId) {
    return { success: false, error: 'Not authenticated.' };
  }
  try {
    const count = await ReportService.markAllRead(session.user.playerId);
    return { success: true, count, unreadReports: 0 };
  } catch {
    return { success: false, error: 'Could not mark reports as read. Please try again.' };
  }
}
