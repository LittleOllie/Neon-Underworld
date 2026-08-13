import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';
import { assertUserNotBanned } from '@/lib/auth/ban-guard';

describe('assertUserNotBanned', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it('allows active users', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ bannedAt: null } as never);
    await expect(assertUserNotBanned('user-1')).resolves.toBeUndefined();
  });

  it('rejects banned users with ACCOUNT_RESTRICTED', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      bannedAt: new Date('2026-08-01'),
    } as never);
    await expect(assertUserNotBanned('user-1')).rejects.toMatchObject({
      gameplayCode: 'ACCOUNT_RESTRICTED',
    });
    await expect(assertUserNotBanned('user-1')).rejects.toBeInstanceOf(GameplayError);
  });
});
