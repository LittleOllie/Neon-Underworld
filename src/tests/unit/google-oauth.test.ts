import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db/prisma';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    account: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth/provision-player', () => ({
  generateUniqueAliasFromEmail: vi.fn().mockResolvedValue('NeonRunner'),
  provisionNewPlayer: vi.fn().mockResolvedValue({
    playerId: 'player-1',
    alias: 'NeonRunner',
    aliasNormalized: 'neonrunner',
    districtSlug: 'neon-strip',
    seasonId: 'season-1',
  }),
}));

describe('google-oauth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.AUTH_GOOGLE_ID = 'google-client-id';
    process.env.AUTH_GOOGLE_SECRET = 'google-client-secret';
  });

  it('rejects unverified Google email', async () => {
    const { validateGoogleSignIn, OAuthAuthError } = await import('@/lib/auth/google-oauth');

    await expect(
      validateGoogleSignIn({
        email: 'new@gmail.com',
        emailVerified: false,
        providerAccountId: 'google-sub-1',
      }),
    ).rejects.toEqual(new OAuthAuthError('email_unverified'));
  });

  it('links verified Google email to existing password account', async () => {
    const { resolveGoogleAuthUser } = await import('@/lib/auth/google-oauth');

    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'player@gmail.com',
        role: 'PLAYER',
        bannedAt: null,
        accounts: [],
        player: { id: 'player-1', alias: 'PlayerOne' },
      } as never)
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'player@gmail.com',
        role: 'PLAYER',
        player: { id: 'player-1', alias: 'PlayerOne' },
      } as never);
    vi.mocked(prisma.account.create).mockResolvedValue({} as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const resolved = await resolveGoogleAuthUser({
      email: 'player@gmail.com',
      emailVerified: true,
      providerAccountId: 'google-sub-1',
    });

    expect(resolved.id).toBe('user-1');
    expect(resolved.playerId).toBe('player-1');
    expect(prisma.account.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'google-sub-1',
      },
    });
  });

  it('returns existing linked Google account without creating a duplicate user', async () => {
    const { resolveGoogleAuthUser } = await import('@/lib/auth/google-oauth');

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      userId: 'user-2',
      user: {
        id: 'user-2',
        email: 'returning@gmail.com',
        role: 'PLAYER',
        player: { id: 'player-2', alias: 'Returner' },
      },
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const resolved = await resolveGoogleAuthUser({
      email: 'returning@gmail.com',
      emailVerified: true,
      providerAccountId: 'google-sub-2',
    });

    expect(resolved.playerId).toBe('player-2');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects when Google account is already linked to a different email user', async () => {
    const { validateGoogleSignIn, OAuthAuthError } = await import('@/lib/auth/google-oauth');

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      user: { id: 'user-3', email: 'other@gmail.com', bannedAt: null },
    } as never);

    await expect(
      validateGoogleSignIn({
        email: 'attacker@gmail.com',
        emailVerified: true,
        providerAccountId: 'google-sub-3',
      }),
    ).rejects.toEqual(new OAuthAuthError('account_conflict'));
  });

  it('creates a new user and player for first-time Google sign-in', async () => {
    const { resolveGoogleAuthUser } = await import('@/lib/auth/google-oauth');
    const { provisionNewPlayer } = await import('@/lib/auth/provision-player');

    vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        user: {
          create: vi.fn().mockResolvedValue({ id: 'user-new' }),
        },
        account: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as never),
    );
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: 'user-new',
      email: 'new@gmail.com',
      role: 'PLAYER',
      player: { id: 'player-1', alias: 'NeonRunner' },
    } as never);

    const resolved = await resolveGoogleAuthUser({
      email: 'new@gmail.com',
      emailVerified: true,
      providerAccountId: 'google-sub-new',
    });

    expect(provisionNewPlayer).toHaveBeenCalled();
    expect(resolved.playerId).toBe('player-1');
  });
});
