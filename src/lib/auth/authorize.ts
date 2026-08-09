import { prisma } from '@/lib/db/prisma';
import { verifyPassword, normalizeEmail } from '@/lib/security/crypto';
import { AUTH_CONFIG } from '@/config/game/balance';
import { checkRateLimit, resetRateLimit } from '@/lib/security/rate-limit';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(AUTH_CONFIG.passwordMinLength),
});

export async function authorizeCredentials(credentials: unknown) {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const email = normalizeEmail(parsed.data.email);
  const rateKey = `login:${email}`;
  const rate = checkRateLimit(
    rateKey,
    AUTH_CONFIG.loginRateLimitMaxAttempts,
    AUTH_CONFIG.loginRateLimitWindowMs,
  );
  if (!rate.allowed) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { player: true },
  });

  if (!user) return null;

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return null;

  if (user.bannedAt) return null;

  resetRateLimit(rateKey);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    playerId: user.player?.id ?? null,
    alias: user.player?.alias ?? null,
  };
}
