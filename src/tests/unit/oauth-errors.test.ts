import { describe, expect, it } from 'vitest';
import { oauthLoginErrorMessage } from '@/lib/auth/oauth-errors';

describe('oauthLoginErrorMessage', () => {
  it('maps known OAuth error codes to human-readable copy', () => {
    expect(oauthLoginErrorMessage('google_cancelled')).toContain('cancelled');
    expect(oauthLoginErrorMessage('account_conflict')).toContain('linked');
    expect(oauthLoginErrorMessage('email_unverified')).toContain('verified');
    expect(oauthLoginErrorMessage('OAuthCallback')).toContain('failed');
  });

  it('does not expose raw provider internals for unknown codes', () => {
    expect(oauthLoginErrorMessage('invalid_client')).toBe(
      'Sign-in failed. Please try again or use email and password.',
    );
  });

  it('returns null for empty input', () => {
    expect(oauthLoginErrorMessage(null)).toBeNull();
    expect(oauthLoginErrorMessage(undefined)).toBeNull();
  });
});
