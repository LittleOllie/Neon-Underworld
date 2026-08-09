'use server';

import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { hashInviteCode, sanitizeText } from '@/lib/security/crypto';
import { inviteCodeSchema } from '@/lib/validation/schemas';
import { toUserMessage } from '@/lib/game-engine/errors';
import type { ActionResult } from '@/server/actions/auth.actions';

async function logAdminAction(adminUserId: string, action: string, metadata?: object) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      metadata: metadata ?? {},
    },
  });
}

export async function createInviteCodeAction(formData: FormData): Promise<ActionResult<{ code: string }>> {
  try {
    const session = await requireAdmin();
    const raw = {
      code: formData.get('code') as string,
      label: (formData.get('label') as string) || undefined,
      maximumUses: parseInt(formData.get('maximumUses') as string) || 1,
      expiresAt: (formData.get('expiresAt') as string) || undefined,
    };

    const parsed = inviteCodeSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const codeHash = await hashInviteCode(parsed.data.code);

    await prisma.inviteCode.create({
      data: {
        codeHash,
        label: parsed.data.label ? sanitizeText(parsed.data.label) : null,
        maximumUses: parsed.data.maximumUses,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        active: true,
      },
    });

    await logAdminAction(session.user.id, 'CREATE_INVITE', { label: parsed.data.label });

    return { success: true, data: { code: parsed.data.code } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function toggleInviteCodeAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    await prisma.inviteCode.update({ where: { id }, data: { active } });
    await logAdminAction(session.user.id, active ? 'ENABLE_INVITE' : 'DISABLE_INVITE', { id });
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function banUserAction(userId: string, reason: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    await prisma.user.update({
      where: { id: userId },
      data: { bannedAt: new Date(), banReason: sanitizeText(reason, 500) },
    });
    await logAdminAction(session.user.id, 'BAN_USER', { userId, reason });
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function unbanUserAction(userId: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    await prisma.user.update({
      where: { id: userId },
      data: { bannedAt: null, banReason: null },
    });
    await logAdminAction(session.user.id, 'UNBAN_USER', { userId });
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function getAdminDashboardData() {
  const session = await requireAdmin();

  const [users, players, invites, auditLogs, scoutResults, adminLogs] = await Promise.all([
    prisma.user.findMany({ include: { player: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.player.findMany({ include: { district: true, turnState: true }, orderBy: { updatedAt: 'desc' }, take: 50 }),
    prisma.inviteCode.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.economicAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.scoutResult.findMany({ include: { player: true, district: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  return { users, players, invites, auditLogs, scoutResults, adminLogs, adminId: session.user.id };
}
