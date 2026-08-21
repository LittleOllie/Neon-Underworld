import { describe, expect, it } from 'vitest';
import { isPasswordResetEmailConfigured } from '@/server/services/password-reset.service';

describe('password reset configuration', () => {
  it('reports unconfigured when env vars missing', () => {
    const prevKey = process.env.RESEND_API_KEY;
    const prevFrom = process.env.PASSWORD_RESET_FROM_EMAIL;
    delete process.env.RESEND_API_KEY;
    delete process.env.PASSWORD_RESET_FROM_EMAIL;
    expect(isPasswordResetEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = prevKey;
    process.env.PASSWORD_RESET_FROM_EMAIL = prevFrom;
  });
});
