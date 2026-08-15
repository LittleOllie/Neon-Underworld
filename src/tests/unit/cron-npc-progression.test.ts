import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@core/lib/db/prisma', () => ({
  prisma: {},
}));

vi.mock('@core/server/services/npc-progression.service', () => ({
  progressActiveSeasonNpcs: vi.fn(async () => ({
    seasonId: 'season-1',
    roundDay: 7,
    processed: 50,
    skipped: 0,
    errors: 0,
  })),
}));

describe('cron npc-progression route auth', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret-value';
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
    vi.resetModules();
  });

  async function loadRoute() {
    return import('../../../NeonUnderworld-OldSkool/src/app/api/cron/npc-progression/route');
  }

  it('rejects missing authorization header', async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://localhost/api/cron/npc-progression'));
    expect(res.status).toBe(401);
  });

  it('rejects wrong bearer token', async () => {
    const { GET } = await loadRoute();
    const res = await GET(
      new Request('http://localhost/api/cron/npc-progression', {
        headers: { authorization: 'Bearer wrong-token' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('accepts correct bearer token', async () => {
    const { GET } = await loadRoute();
    const res = await GET(
      new Request('http://localhost/api/cron/npc-progression', {
        headers: { authorization: 'Bearer test-cron-secret-value' },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(50);
  });

  it('rejects when CRON_SECRET env is unset', async () => {
    delete process.env.CRON_SECRET;
    vi.resetModules();
    const { GET } = await loadRoute();
    const res = await GET(
      new Request('http://localhost/api/cron/npc-progression', {
        headers: { authorization: 'Bearer anything' },
      }),
    );
    expect(res.status).toBe(401);
  });
});
