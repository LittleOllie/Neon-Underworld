'use client';

import { useEffect } from 'react';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import { markReportReadLocally, notifyReportRead } from '@local/lib/reports-read-state';

/** Reconcile shell unread badge after report detail marks read on the server. */
export function ReportReadSync({
  unreadReports,
  reportId,
}: {
  unreadReports?: number;
  reportId?: string;
}) {
  const reconcile = useGameplayReconcile();

  useEffect(() => {
    if (reportId) {
      markReportReadLocally(reportId);
      notifyReportRead();
    }
  }, [reportId]);

  useEffect(() => {
    if (unreadReports != null) {
      reconcile({ unreadReports });
    }
  }, [unreadReports, reconcile]);

  return null;
}
