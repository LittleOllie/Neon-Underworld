'use server';

import {
  requestPasswordReset,
  resetPasswordWithToken,
} from '@core/server/services/password-reset.service';

export async function requestPasswordResetAction(email: string) {
  return requestPasswordReset(email);
}

export async function resetPasswordAction(token: string, password: string, confirmPassword: string) {
  if (password !== confirmPassword) {
    return { ok: false as const, error: 'Passwords do not match.' };
  }
  return resetPasswordWithToken(token, password);
}
