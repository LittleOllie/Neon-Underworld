import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}));

const reportCreate = vi.fn();
const reportFindMany = vi.fn();
const reportFindFirst = vi.fn();
const reportCount = vi.fn();
const reportUpdate = vi.fn();
const reportUpdateMany = vi.fn();
const extFindUnique = vi.fn();
const extUpdate = vi.fn();
const extUpdateMany = vi.fn();
const extUpsert = vi.fn();
const transaction = vi.fn();

vi.mock('@core/lib/db/prisma', () => ({
  prisma: {
    report: {
      create: reportCreate,
      findMany: reportFindMany,
      findFirst: reportFindFirst,
      count: reportCount,
      update: reportUpdate,
      updateMany: reportUpdateMany,
    },
    playerStatusExt: {
      findUnique: extFindUnique,
      update: extUpdate,
      updateMany: extUpdateMany,
      upsert: extUpsert,
    },
    $transaction: transaction,
  },
}));

describe('ReportService inbox semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    transaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op;
    });
  });

  it('does not increment unread for DISTRICT_SCOUT reports', async () => {
    reportCreate.mockResolvedValue({ id: 'r1' });
    const { ReportService } = await import('./report.service');
    await ReportService.create('p1', 'SCOUT', 'Scout Report', 'Summary', {
      metadata: { type: 'DISTRICT_SCOUT' },
    });
    expect(extUpsert).not.toHaveBeenCalled();
  });

  it('increments unread for inbox-eligible reports', async () => {
    reportCreate.mockResolvedValue({ id: 'r2' });
    const { ReportService } = await import('./report.service');
    await ReportService.create('p1', 'COMBAT', 'Attack', 'Summary', {
      metadata: { type: 'ATTACK' },
    });
    expect(extUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerId: 'p1' },
        update: { unreadReports: { increment: 1 } },
      }),
    );
  });

  it('paginates inbox at DB layer with skip/take', async () => {
    reportFindMany.mockResolvedValue([
      {
        id: 'a',
        category: 'COMBAT',
        title: 'T',
        summary: 'S',
        read: false,
        createdAt: new Date(),
        metadata: { type: 'ATTACK' },
      },
    ]);
    const { ReportService } = await import('./report.service');
    const result = await ReportService.listFiltered('p1', 'all', { limit: 25, offset: 0 });
    expect(reportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 26,
        where: expect.objectContaining({
          playerId: 'p1',
          OR: expect.arrayContaining([
            { category: 'COMBAT' },
            { category: 'SYSTEM' },
          ]),
        }),
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it('detects hasMore when an extra row is returned', async () => {
    const rows = Array.from({ length: 26 }, (_, i) => ({
      id: `r${i}`,
      category: 'COMBAT',
      title: 'T',
      summary: 'S',
      read: false,
      createdAt: new Date(),
      metadata: { type: 'ATTACK' },
    }));
    reportFindMany.mockResolvedValue(rows);
    const { ReportService } = await import('./report.service');
    const result = await ReportService.listFiltered('p1', 'all', { limit: 25, offset: 0 });
    expect(result.items).toHaveLength(25);
    expect(result.hasMore).toBe(true);
  });

  it('reconciles ext unread counter to true inbox count', async () => {
    reportCount.mockResolvedValue(2);
    extFindUnique.mockResolvedValue({ unreadReports: 5 });
    extUpdate.mockResolvedValue({});
    const { ReportService } = await import('./report.service');
    const count = await ReportService.getUnreadCount('p1');
    expect(count).toBe(2);
    expect(extUpdate).toHaveBeenCalledWith({
      where: { playerId: 'p1' },
      data: { unreadReports: 2 },
    });
  });

  it('markRead is idempotent and skips badge decrement for district scout', async () => {
    reportFindFirst.mockResolvedValue({
      id: 'r1',
      read: true,
      metadata: { type: 'DISTRICT_SCOUT' },
      category: 'SCOUT',
    });
    reportCount.mockResolvedValue(0);
    extFindUnique.mockResolvedValue({ unreadReports: 0 });
    const { ReportService } = await import('./report.service');
    const count = await ReportService.markRead('r1', 'p1');
    expect(reportUpdate).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });

  it('markRead decrements badge only for inbox reports', async () => {
    reportFindFirst.mockResolvedValue({
      id: 'r2',
      read: false,
      metadata: { type: 'ATTACK' },
      category: 'COMBAT',
    });
    reportUpdate.mockResolvedValue({});
    extUpdateMany.mockResolvedValue({ count: 1 });
    reportCount.mockResolvedValue(1);
    extFindUnique.mockResolvedValue({ unreadReports: 1 });
    const { ReportService } = await import('./report.service');
    await ReportService.markRead('r2', 'p1');
    expect(extUpdateMany).toHaveBeenCalled();
  });
});

describe('inboxReportWhere', () => {
  it('excludes district scout via metadata filter', async () => {
    const { inboxReportWhere, isPlayerInboxReport } = await import('./report.service');
    expect(isPlayerInboxReport({ type: 'DISTRICT_SCOUT' }, 'SCOUT')).toBe(false);
    const where = inboxReportWhere('p1', { unreadOnly: true });
    expect(where.read).toBe(false);
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { category: 'SCOUT', metadata: { path: ['type'], equals: 'PLAYER_INTEL' } },
      ]),
    );
  });
});
