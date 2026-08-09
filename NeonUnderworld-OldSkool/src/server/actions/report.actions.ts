'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@local/lib/auth/config';
import { ReportService } from '@local/server/services/report.service';

export async function markReportReadAction(reportId: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.playerId) return { ok: false };
  const ok = await ReportService.markRead(reportId, session.user.playerId);
  if (ok) {
    revalidatePath('/command');
    revalidatePath('/reports');
  }
  return { ok };
}

export async function markAllReportsReadAction(): Promise<
  { success: true; count: number } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.playerId) {
    return { success: false, error: 'Not authenticated.' };
  }
  try {
    const count = await ReportService.markAllRead(session.user.playerId);
    revalidatePath('/command');
    revalidatePath('/reports');
    return { success: true, count };
  } catch {
    return { success: false, error: 'Could not mark reports as read. Please try again.' };
  }
}
