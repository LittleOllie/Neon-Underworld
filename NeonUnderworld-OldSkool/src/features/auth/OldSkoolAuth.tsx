'use client';

import { useRef, useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { AuthShell } from '@local/components/game/AuthShell';
import {
  classifySignInFailure,
  confirmAuthenticatedSession,
  loginFailureMessage,
  resolvePostLoginPath,
} from '@local/features/auth/login-session';

function readAdminRequired(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('error') === 'admin_required';
}

export function LoginForm() {
  const [adminRequired] = useState(readAdminRequired);
  const [error, setError] = useState(
    adminRequired ? 'Admin access only. Sign in with your operator account.' : '',
  );
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

      // Full navigation gives middleware/server auth a clean request with the new cookie.
      window.location.assign(resolvePostLoginPath(adminRequired));
    } catch {
      setError(loginFailureMessage('network'));
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Login">
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
          New player? <Link href="/register">Register</Link>
        </p>
      </form>
    </AuthShell>
  );
}
