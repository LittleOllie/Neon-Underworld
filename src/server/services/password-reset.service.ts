import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const BCRYPT_ROUNDS = 12;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function appBaseUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3302';
}

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.PASSWORD_RESET_FROM_EMAIL);
}

async function sendResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM_EMAIL;
  if (!apiKey || !from) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Reset your Neon Underworld password',
      html: `<p>You requested a password reset for Neon Underworld.</p><p><a href="${resetUrl}">Choose a new password</a></p><p>This link expires in one hour. If you did not request this, ignore this email.</p>`,
      text: `Reset your Neon Underworld password: ${resetUrl}\n\nThis link expires in one hour.`,
    }),
  });

  if (!response.ok) {
    console.error('[password-reset] email send failed', response.status, await response.text());
    return false;
  }
  return true;
}

/** Always returns the same generic message — never reveals account existence. */
export async function requestPasswordReset(email: string): Promise<{ ok: true; message: string }> {
  const normalized = email.trim().toLowerCase();
  const genericMessage =
    "If an account exists for that email, we've sent password reset instructions.";

  if (!normalized) {
    return { ok: true, message: genericMessage };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, bannedAt: true },
  });

  if (!user || user.bannedAt) {
    return { ok: true, message: genericMessage };
  }

  if (!isPasswordResetEmailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[password-reset] RESEND_API_KEY / PASSWORD_RESET_FROM_EMAIL not configured');
    }
    return { ok: true, message: genericMessage };
  }

  const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  await sendResetEmail(user.email, resetUrl);

  return { ok: true, message: genericMessage };
}

export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!rawToken.trim()) {
    return { ok: false, error: 'Invalid or expired reset link.' };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const tokenHash = hashToken(rawToken.trim());
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, bannedAt: true } } },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now() || record.user.bannedAt) {
    return { ok: false, error: 'Invalid or expired reset link.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, id: { not: record.id }, usedAt: null },
    }),
  ]);

  return { ok: true };
}
