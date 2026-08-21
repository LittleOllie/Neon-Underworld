# Password Reset Setup (Neon Underworld)

Password reset is implemented for the OldSkool build. Email delivery requires external configuration before reset links are actually sent.

## Flow

1. Player opens **Login → Forgot password?**
2. Enters email on `/forgot-password`
3. Server always responds with a generic confirmation (no email enumeration)
4. If the account exists and email is configured, a one-hour reset link is emailed
5. Player opens `/reset-password?token=…`, sets a new password, returns to login

## Database

Migration: `prisma/migrations/20260820143000_password_reset_tokens/migration.sql`

Run before the live test:

```bash
npm run db:migrate --prefix ..
# or
npx prisma migrate deploy --schema=../prisma/schema.prisma
```

## Required environment variables (production / live test)

| Variable | Purpose |
|----------|---------|
| `APP_URL` | Base URL for reset links (e.g. `https://play.neonunderworld.com`) |
| `RESEND_API_KEY` | [Resend](https://resend.com) API key |
| `PASSWORD_RESET_FROM_EMAIL` | Verified sender, e.g. `Neon Underworld <noreply@yourdomain.com>` |

Add to Vercel/hosting env and to local `.env` for testing.

## Behaviour without email configured

- Forgot-password form still works and shows the generic confirmation message
- No reset email is sent (logged in dev: `RESEND_API_KEY / PASSWORD_RESET_FROM_EMAIL not configured`)
- Tokens are **not** created when email is not configured (avoids orphan tokens)
- For local admin recovery, update `User.passwordHash` directly or use seed scripts

## Security

- Tokens: 32-byte random, SHA-256 hashed at rest
- Expiry: 1 hour
- Single use: marked `usedAt` on success; other pending tokens for the user are cleared
- Banned accounts cannot request or complete reset
- Minimum password length: 8 characters (matches registration)

## Code locations

- Service: `src/server/services/password-reset.service.ts`
- Actions: `NeonUnderworld-OldSkool/src/server/actions/password-reset.actions.ts`
- UI: `NeonUnderworld-OldSkool/src/features/auth/ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`
