'use server';

import { auth } from '@local/lib/auth/config';
import { ReportService } from '@local/server/services/report.service';

export async function markReportReadAction(reportId: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.playerId) return { ok: false };
  const ok = await ReportService.markRead(reportId, session.user.playerId);
  return { ok };
}

export async function markAllReportsReadAction(): Promise<{ count: number }> {
  const session = await auth();
  if (!session?.user?.playerId) return { count: 0 };
  const count = await ReportService.markAllRead(session.user.playerId);
  return { count };
}
