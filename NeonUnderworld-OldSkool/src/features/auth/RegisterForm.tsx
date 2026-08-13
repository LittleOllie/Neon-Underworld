'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerAction } from '@local/server/actions/auth.actions';

interface RegisterFormProps {
  districts: Array<{ slug: string; name: string; description: string }>;
}

export function RegisterForm({ districts }: RegisterFormProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const result = await registerAction(formData);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push('/identity/select');
    router.refresh();
  }

  return (
    <form className="g-auth-form" onSubmit={handleSubmit}>
      <label className="g-auth-field">
        <span className="g-field-label">Invite code</span>
        <input
          id="inviteCode"
          name="inviteCode"
          required
          className="g-input g-auth-input"
          placeholder="NEON-ALPHA-2026"
        />
      </label>
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
          className="g-input g-auth-input"
          autoComplete="new-password"
        />
      </label>
      <label className="g-auth-field">
        <span className="g-field-label">Alias</span>
        <input
          id="alias"
          name="alias"
          required
          className="g-input g-auth-input"
          autoComplete="username"
        />
      </label>

      <fieldset className="g-auth-districts">
        <legend className="g-field-label">District</legend>
        {districts.map((d) => (
          <label key={d.slug} className="g-auth-district-option">
            <input type="radio" name="districtSlug" value={d.slug} required />
            <span>
              <strong>{d.name}</strong>
              <span className="g-auth-district-desc">{d.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {error && (
        <p className="g-auth-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="g-btn g-auth-submit" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      <p className="g-auth-foot">
        Already registered? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
