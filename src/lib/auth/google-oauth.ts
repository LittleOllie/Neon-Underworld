import { prisma } from '@/lib/db/prisma';
import { normalizeEmail } from '@/lib/security/crypto';
import {
  generateUniqueAliasFromEmail,
  provisionNewPlayer,
} from '@/lib/auth/provision-player';

export type OAuthAuthErrorCode =
  | 'email_unverified'
  | 'account_restricted'
  | 'account_conflict'
  | 'oauth_unavailable'
  | 'oauth_failed';

export class OAuthAuthError extends Error {
  readonly code: OAuthAuthErrorCode;

  constructor(code: OAuthAuthErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'OAuthAuthError';
  }
}

export interface ResolvedAuthUser {
  id: string;
  email: string;
  role: string;
  playerId: string | null;
  alias: string | null;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

function toResolved(user: {
  id: string;
  email: string;
  role: string;
  player: { id: string; alias: string } | null;
}): ResolvedAuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    playerId: user.player?.id ?? null,
    alias: user.player?.alias ?? null,
  };
}

export async function validateGoogleSignIn(input: {
  email: string;
  emailVerified: boolean;
  providerAccountId: string;
}): Promise<void> {
  if (!isGoogleOAuthConfigured()) {
    throw new OAuthAuthError('oauth_unavailable');
  }

  if (!input.emailVerified) {
    throw new OAuthAuthError('email_unverified');
  }

  const email = normalizeEmail(input.email);
  const linkedAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: 'google',
        providerAccountId: input.providerAccountId,
      },
    },
    include: { user: { select: { id: true, email: true, bannedAt: true } } },
  });

  if (linkedAccount) {
    if (linkedAccount.user.bannedAt) {
      throw new OAuthAuthError('account_restricted');
    }
    if (normalizeEmail(linkedAccount.user.email) !== email) {
      throw new OAuthAuthError('account_conflict');
    }
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { accounts: { where: { provider: 'google' } } },
  });

  if (existingUser?.bannedAt) {
    throw new OAuthAuthError('account_restricted');
  }

  const existingGoogle = existingUser?.accounts[0];
  if (existingGoogle && existingGoogle.providerAccountId !== input.providerAccountId) {
    throw new OAuthAuthError('account_conflict');
  }
}

export async function resolveGoogleAuthUser(input: {
  email: string;
  emailVerified: boolean;
  providerAccountId: string;
}): Promise<ResolvedAuthUser> {
  await validateGoogleSignIn(input);

  const email = normalizeEmail(input.email);
  const now = new Date();

  const linkedAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: 'google',
        providerAccountId: input.providerAccountId,
      },
    },
    include: { user: { include: { player: true } } },
  });

  if (linkedAccount) {
    await prisma.user.update({
      where: { id: linkedAccount.user.id },
      data: { lastLoginAt: now },
    });
    return toResolved(linkedAccount.user);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { player: true, accounts: { where: { provider: 'google' } } },
  });

  if (existingUser) {
    const linkedAccounts = existingUser.accounts ?? [];
    if (!linkedAccounts.some((a) => a.providerAccountId === input.providerAccountId)) {
      await prisma.account.create({
        data: {
          userId: existingUser.id,
          provider: 'google',
          providerAccountId: input.providerAccountId,
        },
      });
    }

    await prisma.user.update({
      where: { id: existingUser.id },
      data: { lastLoginAt: now },
    });

    return toResolved(existingUser);
  }

  const alias = await generateUniqueAliasFromEmail(prisma, email);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        passwordHash: null,
        role: 'PLAYER',
        lastLoginAt: now,
      },
    });

    await tx.account.create({
      data: {
        userId: createdUser.id,
        provider: 'google',
        providerAccountId: input.providerAccountId,
      },
    });

    return createdUser;
  });

  const provisioned = await provisionNewPlayer(prisma, {
    userId: user.id,
    alias,
    auditSource: 'google_oauth',
  });

  const fullUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { player: true },
  });

  if (!fullUser.player || fullUser.player.id !== provisioned.playerId) {
    throw new OAuthAuthError('oauth_failed');
  }

  return toResolved(fullUser);
}
