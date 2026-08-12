import Link from 'next/link';
import { PageTitle } from '@local/components/game';
import { requireGameSession, formatRelativeTime } from '@local/lib/game-context';
import { ReportService, getUnreadReportCount } from '@local/server/services/report.service';
import { MarkAllReadButton } from '@local/features/reports/MarkAllReadButton';
import { devPerf } from '@local/lib/dev-perf';

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
] as const;

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const filterParam = params.filter ?? 'all';
  const filter = filterParam === 'unread' ? 'unread' : 'all';

  const { playerId } = await requireGameSession();

  const { reports, unreadCount } = await devPerf('/reports data', async () => {
    const [reports, unreadCount] = await Promise.all([
      ReportService.listFiltered(playerId, filter),
      getUnreadReportCount(playerId),
    ]);
    return { reports, unreadCount };
  });

  return (
    <>
      <PageTitle icon="reports">Reports</PageTitle>

      <div className="g-filter-row">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'all' ? '/reports' : `/reports?filter=${f.key}`}
            className={`g-filter${filter === f.key ? ' g-filter-active' : ''}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {unreadCount > 0 && (
        <div style={{ marginBottom: 12 }}>
          <MarkAllReadButton />
        </div>
      )}

      {reports.length === 0 ? (
        <p className="g-note">No reports match this filter.</p>
      ) : (
        reports.map((r) => (
          <Link
            key={r.id}
            href={`/reports/${r.id}`}
            className={`g-inbox-item${r.read ? '' : ' g-inbox-unread'}`}
          >
            <div className="g-inbox-title">{r.title}</div>
            {r.summary && <div className="g-inbox-meta">{r.summary}</div>}
            <div className="g-inbox-meta">{formatRelativeTime(r.createdAt)}</div>
          </Link>
        ))
      )}
    </>
  );
}
