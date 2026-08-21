import type { OAuthAuthErrorCode } from '@/lib/auth/google-oauth';

/** Human-readable login errors — no provider internals or account enumeration. */
export function oauthLoginErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;

  switch (code) {
    case 'email_unverified':
      return 'Google sign-in requires a verified email address.';
    case 'account_restricted':
      return 'This account cannot sign in right now.';
    case 'account_conflict':
      return 'Google sign-in could not be linked to this account. Contact support if you need help.';
    case 'oauth_unavailable':
      return 'Google sign-in is not available right now.';
    case 'oauth_failed':
    case 'OAuthSignin':
    case 'OAuthCallback':
    case 'OAuthCreateAccount':
    case 'Callback':
      return 'Google sign-in failed. Please try again.';
    case 'OAuthAccountNotLinked':
    case 'account_link':
      return 'Google sign-in could not be linked to this account.';
    case 'AccessDenied':
    case 'google_cancelled':
      return 'Google sign-in was cancelled.';
    default:
      return 'Sign-in failed. Please try again or use email and password.';
  }
}

export function authErrorCodeFromOAuthError(error: unknown): OAuthAuthErrorCode | 'oauth_failed' {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    if (
      code === 'email_unverified' ||
      code === 'account_restricted' ||
      code === 'account_conflict' ||
      code === 'oauth_unavailable'
    ) {
      return code;
    }
  }
  return 'oauth_failed';
}
