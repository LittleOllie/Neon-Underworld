/**
 * Validates required environment variables at startup (server-only).
 * Never logs secret values.
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    missing.push('AUTH_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required production env: ${missing.join(', ')}`);
  }

  if (process.env.PLAYTEST_TURNS === 'true' || process.env.NEXT_PUBLIC_PLAYTEST_TURNS === 'true') {
    throw new Error(
      'PLAYTEST_TURNS must not be enabled in production. Remove PLAYTEST_TURNS and NEXT_PUBLIC_PLAYTEST_TURNS from production env.',
    );
  }
}
