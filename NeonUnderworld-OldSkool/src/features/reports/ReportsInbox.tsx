'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@local/components/game/EmptyState';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { formatRelativeTime } from '@local/lib/format-relative-time';
import type { ReportListItem } from '@local/server/services/report.service';
import { loadMoreReportsAction, markAllReportsReadAction } from '@local/server/actions/report.actions';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import {
  getLocallyReadReportIds,
  markAllReportsReadLocally,
  notifyReportsMarkAllRead,
  REPORT_READ_EVENT,
  REPORTS_MARK_ALL_READ_EVENT,
} from '@local/lib/reports-read-state';

interface Props {
  initialReports: ReportListItem[];
  initialHasMore: boolean;
  filter: 'all' | 'unread';
  unreadCount: number;
}

function isVisuallyRead(report: ReportListItem, locallyRead: Set<string>): boolean {
  return report.read || locallyRead.has(report.id);
}

export function ReportsInbox({ initialReports, initialHasMore, filter, unreadCount }: Props) {
  const reconcile = useGameplayReconcile();
  const [reports, setReports] = useState(initialReports);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markAllError, setMarkAllError] = useState('');
  const [locallyRead, setLocallyRead] = useState<Set<string>>(() => getLocallyReadReportIds());

  const syncLocalRead = useCallback(() => {
    setLocallyRead(getLocallyReadReportIds());
  }, []);

  useEffect(() => {
    setReports(initialReports);
    setHasMore(initialHasMore);
  }, [initialReports, initialHasMore, filter]);

  useEffect(() => {
    syncLocalRead();
    window.addEventListener(REPORT_READ_EVENT, syncLocalRead);
    window.addEventListener(REPORTS_MARK_ALL_READ_EVENT, syncLocalRead);
    window.addEventListener('popstate', syncLocalRead);
    window.addEventListener('pageshow', syncLocalRead);
    return () => {
      window.removeEventListener(REPORT_READ_EVENT, syncLocalRead);
      window.removeEventListener(REPORTS_MARK_ALL_READ_EVENT, syncLocalRead);
      window.removeEventListener('popstate', syncLocalRead);
      window.removeEventListener('pageshow', syncLocalRead);
    };
  }, [syncLocalRead]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const result = await loadMoreReportsAction(filter, reports.length);
    setLoadingMore(false);
    if ('error' in result) return;

    setReports((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      const appended = result.items.filter((r) => !seen.has(r.id));
      return [...prev, ...appended];
    });
    setHasMore(result.hasMore);
  }

  async function handleMarkAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    setMarkAllError('');
    const result = await markAllReportsReadAction();
    setMarkingAll(false);
    if (!result.success) {
      setMarkAllError(result.error);
      return;
    }
    setReports((prev) => {
      markAllReportsReadLocally(prev.map((r) => r.id));
      return prev.map((r) => ({ ...r, read: true }));
    });
    notifyReportsMarkAllRead();
    reconcile({ unreadReports: 0 });
  }

  if (reports.length === 0) {
    return (
      <EmptyState
        title="No reports"
        body={
          filter === 'unread'
            ? 'You have read everything in your inbox.'
            : 'Scout, attack, and run your empire — reports appear here.'
        }
        actionHref="/scout"
        actionLabel="Go scouting"
      />
    );
  }

  return (
    <>
      {unreadCount > 0 && (
        <div style={{ marginBottom: 12 }}>
          <PrimaryButton
            variant="secondary"
            icon="reports"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            pending={markingAll}
          >
            {markingAll ? 'Marking…' : 'Mark all read'}
          </PrimaryButton>
          {markAllError && <p className="g-error">{markAllError}</p>}
        </div>
      )}

      {reports.map((r) => {
        const read = isVisuallyRead(r, locallyRead);
        return (
          <Link
            key={r.id}
            href={`/reports/${r.id}`}
            className={`g-inbox-item${read ? '' : ' g-inbox-unread'}`}
          >
            <div className="g-inbox-title">{r.title}</div>
            {r.summary && <div className="g-inbox-meta">{r.summary}</div>}
            <div className="g-inbox-meta">{formatRelativeTime(r.createdAt)}</div>
          </Link>
        );
      })}

      {hasMore && (
        <p className="g-note" style={{ marginTop: 16 }}>
          <PrimaryButton
            variant="secondary"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more reports'}
          </PrimaryButton>
        </p>
      )}
    </>
  );
}
