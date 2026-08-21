'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@local/components/game/AuthShell';
import { requestPasswordResetAction } from '@local/server/actions/password-reset.actions';

export function ForgotPasswordForm() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitLock = useRef(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitLock.current || loading) return;

    submitLock.current = true;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const form = new FormData(e.currentTarget);
      const email = String(form.get('email') ?? '');
      const result = await requestPasswordResetAction(email);
      setMessage(result.message);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Forgot Password">
      <p className="g-note">
        Enter the email you used to register. We&apos;ll send reset instructions if an account exists.
      </p>
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
        {error && (
          <p className="g-auth-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="g-auth-success" role="status">
            {message}
          </p>
        )}
        <button type="submit" className="g-btn g-auth-submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
        <p className="g-auth-foot">
          <Link href="/login">Back to sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
