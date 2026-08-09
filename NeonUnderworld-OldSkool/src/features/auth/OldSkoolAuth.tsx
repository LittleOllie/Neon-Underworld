'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { AuthShell } from '@local/components/game/AuthShell';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const result = await signIn('credentials', {
      email: form.get('email') as string,
      password: form.get('password') as string,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }
    router.push('/command');
    router.refresh();
  }

  return (
    <AuthShell title="Login">
      <form className="g-auth-form" onSubmit={handleSubmit}>
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
