import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/auth/ban-guard', () => ({
  assertUserNotBanned: vi.fn(async () => {}),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import { auth } from '@/lib/auth/config';
import { requireAdmin } from '@/lib/auth/session';
import { AdminTurnGrantService } from '@/server/services/admin-turn-grant.service';
import { isAdminSchemaReady } from '@/lib/db/admin-schema-readiness';
import { getPlayerSeasonActivatedAt } from '@/lib/db/admin-analytics-db';
import { prisma } from '@/lib/db/prisma';

vi.mock('@/lib/db/admin-schema-readiness', () => ({
  isAdminSchemaReady: vi.fn(async () => true),
}));

vi.mock('@/lib/db/admin-analytics-db', () => ({
  getPlayerSeasonActivatedAt: vi.fn(async () => null),
  listActivatedHumanPlayerIds: vi.fn(async () => []),
}));

describe('admin security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects non-admin users away from admin actions', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', role: 'PLAYER', playerId: 'p1' },
    } as never);

    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/command');
  });

  it('allows admin users through requireAdmin', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', playerId: 'p-admin' },
    } as never);

    const session = await requireAdmin();
    expect(session.user.role).toBe('ADMIN');
  });

  it('rejects turn grants for humans who have not activated in the current round', async () => {
    vi.mocked(isAdminSchemaReady).mockResolvedValue(true);
    vi.mocked(getPlayerSeasonActivatedAt).mockResolvedValue(null);

    vi.spyOn(prisma.player, 'findUnique').mockResolvedValue({
      id: 'p1',
      alias: 'Tester',
      seasonId: 'season-1',
      turnState: {
        currentTurns: 100,
        lastRegeneratedAt: new Date(),
        turnCap: 5000,
        regenerationRate: 1,
      },
      user: { email: 'human@test.local' },
    } as never);

    await expect(
      AdminTurnGrantService.grantToPlayer('admin-1', 'p1', 50, 'test grant'),
    ).rejects.toThrow('Player has not activated in the current round');
  });

  it('bulk turn grant preview returns zero when no activated humans', async () => {
    vi.mocked(isAdminSchemaReady).mockResolvedValue(true);
    const preview = await AdminTurnGrantService.previewBulkGrant('season-1');
    expect(preview.affectedCount).toBe(0);
  });
});
