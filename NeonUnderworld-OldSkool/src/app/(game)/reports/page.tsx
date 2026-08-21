import Link from 'next/link';
import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { ReportService, getUnreadReportCount } from '@local/server/services/report.service';
import { ReportsInbox } from '@local/features/reports/ReportsInbox';
import { devPerf } from '@local/lib/dev-perf';

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
] as const;

const PAGE_SIZE = 25;

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const filterParam = params.filter ?? 'all';
  const filter = filterParam === 'unread' ? 'unread' : 'all';

  const { playerId } = await requireGameSession();

  const { reports, hasMore, unreadCount } = await devPerf('/reports data', async () => {
    const [listed, unreadCount] = await Promise.all([
      ReportService.listFiltered(playerId, filter, { limit: PAGE_SIZE, offset: 0 }),
      getUnreadReportCount(playerId),
    ]);
    return { reports: listed.items, hasMore: listed.hasMore, unreadCount };
  });

  return (
    <>
      <PageTitle icon="reports">Reports</PageTitle>

      <div className="g-gameplay-controls g-reports-chrome">
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

      <ReportsInbox
        key={filter}
        initialReports={reports}
        initialHasMore={hasMore}
        filter={filter}
        unreadCount={unreadCount}
      />
      </div>
    </>
  );
}
