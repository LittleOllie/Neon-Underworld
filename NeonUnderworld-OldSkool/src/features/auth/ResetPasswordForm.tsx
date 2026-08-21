'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@local/components/game/AuthShell';
import { resetPasswordAction } from '@local/server/actions/password-reset.actions';

type Props = {
  token: string;
};

export function ResetPasswordForm({ token }: Props) {
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const submitLock = useRef(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitLock.current || loading || !token) return;

    submitLock.current = true;
    setLoading(true);
    setError('');

    try {
      const form = new FormData(e.currentTarget);
      const password = String(form.get('password') ?? '');
      const confirmPassword = String(form.get('confirmPassword') ?? '');
      const result = await resetPasswordAction(token, password, confirmPassword);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Reset Password">
        <p className="g-auth-error" role="alert">
          Invalid or missing reset link.
        </p>
        <p className="g-auth-foot">
          <Link href="/forgot-password">Request a new reset link</Link>
        </p>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password Updated">
        <p className="g-auth-success" role="status">
          Your password has been updated. You can sign in now.
        </p>
        <p className="g-auth-foot">
          <Link href="/login">Sign in</Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose New Password">
      <form className="g-auth-form" method="post" onSubmit={handleSubmit}>
        <label className="g-auth-field">
          <span className="g-field-label">New password</span>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="g-input g-auth-input"
            autoComplete="new-password"
          />
        </label>
        <label className="g-auth-field">
          <span className="g-field-label">Confirm password</span>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            className="g-input g-auth-input"
            autoComplete="new-password"
          />
        </label>
        <p className="g-note">Minimum 8 characters.</p>
        {error && (
          <p className="g-auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="g-btn g-auth-submit" disabled={loading}>
          {loading ? 'Updating…' : 'Update password'}
        </button>
        <p className="g-auth-foot">
          <Link href="/login">Back to sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
