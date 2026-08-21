'use client';

import { useRef, useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthShell } from '@local/components/game/AuthShell';
import { GoogleSignInButton, AuthDivider } from '@local/features/auth/GoogleSignInButton';
import { oauthLoginErrorMessage } from '@core/lib/auth/oauth-errors';
import {
  classifySignInFailure,
  confirmAuthenticatedSession,
  loginFailureMessage,
  resolvePostLoginPath,
} from '@local/features/auth/login-session';

function readAdminRequired(searchParams: URLSearchParams): boolean {
  return searchParams.get('error') === 'admin_required';
}

function readInitialError(searchParams: URLSearchParams): string {
  const authError = searchParams.get('authError') ?? searchParams.get('error');
  return oauthLoginErrorMessage(authError) ?? '';
}

export function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const searchParams = useSearchParams();
  const adminRequired = readAdminRequired(searchParams);
  const [error, setError] = useState(() => {
    const oauthError = readInitialError(searchParams);
    if (oauthError) return oauthError;
    return adminRequired ? 'Admin access only. Sign in with your operator account.' : '';
  });
  const [loading, setLoading] = useState(false);
  const submitLock = useRef(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitLock.current || loading) return;

    submitLock.current = true;
    setLoading(true);
    setError('');

    try {
      const form = new FormData(e.currentTarget);
      const result = await signIn('credentials', {
        email: form.get('email') as string,
        password: form.get('password') as string,
        redirect: false,
      });

      const signInFailure = classifySignInFailure(result);
      if (signInFailure) {
        setError(loginFailureMessage(signInFailure));
        return;
      }

      const sessionReady = await confirmAuthenticatedSession(() => getSession());
      if (!sessionReady) {
        setError(loginFailureMessage('session_confirmation'));
        return;
      }

      window.location.assign(resolvePostLoginPath(adminRequired));
    } catch {
      setError(loginFailureMessage('network'));
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Sign In">
      <GoogleSignInButton enabled={googleEnabled} callbackUrl="/command" />
      {googleEnabled ? <AuthDivider /> : null}
      <form className="g-auth-form" method="post" onSubmit={handleSubmit}>
        <label className="g-auth-field">
          <span className="g-field-label">Email</span>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="g-input g-auth-input"
            autoComplete="email"
          />
        </label>
        <label className="g-auth-field">
          <span className="g-field-label">Password</span>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="g-input g-auth-input"
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p className="g-auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="g-btn g-auth-submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="g-auth-foot">
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
        <p className="g-auth-foot">
          New player? <Link href="/register">Register</Link>
        </p>
      </form>
    </AuthShell>
  );
}
