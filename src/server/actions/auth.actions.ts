'use server';

import { prisma } from '@/lib/db/prisma';
import {
  hashPassword,
  verifyInviteCode,
  normalizeEmail,
  normalizeAlias,
  sanitizeText,
} from '@/lib/security/crypto';
import { registerSchema } from '@/lib/validation/schemas';
import { STARTING_RESOURCES } from '@/config/game/balance';
import { createInitialTurnState } from '@/lib/game-engine/turns';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '@/lib/game-engine/happiness';
import { DomainError, toUserMessage } from '@/lib/game-engine/errors';
import { snapshotPlayerState } from '@/lib/game-engine/state';
import { signIn } from '@/lib/auth/config';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function registerAction(formData: FormData): Promise<ActionResult<{ alias: string }>> {
  try {
    const raw = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string,
      inviteCode: formData.get('inviteCode') as string,
      alias: formData.get('alias') as string,
      districtSlug: formData.get('districtSlug') as string,
    };

    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const email = normalizeEmail(parsed.data.email);
    const alias = sanitizeText(parsed.data.alias, AUTH_CONFIG_ALIAS_MAX);
    const aliasNormalized = normalizeAlias(alias);

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return { success: false, error: 'Unable to create account. Check your details and try again.' };
    }

    const existingAlias = await prisma.player.findUnique({ where: { aliasNormalized } });
    if (existingAlias) {
      return { success: false, error: 'This alias is already taken' };
    }

    const district = await prisma.district.findUnique({
      where: { slug: parsed.data.districtSlug, active: true },
    });
    if (!district) {
      return { success: false, error: 'Selected district is not available' };
    }

    const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } });
    if (!season) {
      return { success: false, error: 'No active season. Registration is temporarily unavailable.' };
    }

    const inviteCodes = await prisma.inviteCode.findMany({ where: { active: true } });
    let matchedInvite: (typeof inviteCodes)[0] | null = null;
    for (const invite of inviteCodes) {
      if (await verifyInviteCode(parsed.data.inviteCode, invite.codeHash)) {
        matchedInvite = invite;
        break;
      }
    }
    if (!matchedInvite) {
      return { success: false, error: 'Invalid or expired invite code' };
    }
    if (matchedInvite.expiresAt && matchedInvite.expiresAt < new Date()) {
      return { success: false, error: 'Invalid or expired invite code' };
    }
    if (matchedInvite.currentUses >= matchedInvite.maximumUses) {
      return { success: false, error: 'Invalid or expired invite code' };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const initialTurns = createInitialTurnState();

    const prostituteHappiness = calculateProstituteHappiness({
      prostitutes: STARTING_RESOURCES.prostitutes,
      thugs: STARTING_RESOURCES.thugs,
      hash: STARTING_RESOURCES.hash,
      condoms: STARTING_RESOURCES.condoms,
      prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
    }).score;

    const thugHappiness = calculateThugHappiness({
      thugs: STARTING_RESOURCES.thugs,
      glocks: STARTING_RESOURCES.glocks,
      uzis: STARTING_RESOURCES.uzis,
      aks: STARTING_RESOURCES.aks,
      beer: STARTING_RESOURCES.beer,
    }).score;

    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: 'PLAYER',
        },
      });

      const player = await tx.player.create({
        data: {
          userId: newUser.id,
          alias,
          aliasNormalized,
          districtId: district.id,
          seasonId: season.id,
          cash: STARTING_RESOURCES.cash,
          prostitutes: STARTING_RESOURCES.prostitutes,
          thugs: STARTING_RESOURCES.thugs,
          rides: STARTING_RESOURCES.rides,
          glocks: STARTING_RESOURCES.glocks,
          uzis: STARTING_RESOURCES.uzis,
          aks: STARTING_RESOURCES.aks,
          beer: STARTING_RESOURCES.beer,
          condoms: STARTING_RESOURCES.condoms,
          hash: STARTING_RESOURCES.hash,
          shrooms: STARTING_RESOURCES.shrooms,
          coke: STARTING_RESOURCES.coke,
          heroin: STARTING_RESOURCES.heroin,
          prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
          prostituteHappiness,
          thugHappiness,
        },
      });

      await tx.playerTurnState.create({
        data: {
          playerId: player.id,
          currentTurns: initialTurns.currentTurns,
          lastRegeneratedAt: initialTurns.lastRegeneratedAt,
          turnCap: initialTurns.turnCap,
          regenerationRate: initialTurns.regenerationRatePerMs,
        },
      });

      await tx.inviteCodeUse.create({
        data: {
          inviteCodeId: matchedInvite!.id,
          userId: newUser.id,
        },
      });

      await tx.inviteCode.update({
        where: { id: matchedInvite!.id },
        data: { currentUses: { increment: 1 } },
      });

      await tx.economicAuditLog.create({
        data: {
          playerId: player.id,
          userId: newUser.id,
          eventType: 'PLAYER_REGISTERED',
          source: 'registration',
          beforeState: {},
          delta: snapshotPlayerState({
            cash: STARTING_RESOURCES.cash,
            prostitutes: STARTING_RESOURCES.prostitutes,
            thugs: STARTING_RESOURCES.thugs,
          }) as object,
          afterState: snapshotPlayerState({
            cash: STARTING_RESOURCES.cash,
            prostitutes: STARTING_RESOURCES.prostitutes,
            thugs: STARTING_RESOURCES.thugs,
          }) as object,
          metadata: { districtSlug: district.slug, alias },
        },
      });

      return newUser;
    });

    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });

    return { success: true, data: { alias } };
  } catch (error) {
    if (error instanceof DomainError) {
      return { success: false, error: error.message };
    }
    console.error('Registration error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}

const AUTH_CONFIG_ALIAS_MAX = 20;
