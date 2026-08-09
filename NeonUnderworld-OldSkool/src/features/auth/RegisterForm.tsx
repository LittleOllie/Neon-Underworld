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
    router.push('/command');
    router.refresh();
  }

  return (
    <div className="os-section">
      <div className="os-section-title">New Operator Registration</div>
      <div className="os-section-body">
        <form onSubmit={handleSubmit}>
          <table className="os-table">
            <tbody>
              <tr>
                <td><label htmlFor="inviteCode">Invite code</label></td>
                <td><input id="inviteCode" name="inviteCode" required className="os-input" style={{ width: '100%' }} placeholder="NEON-ALPHA-2026" /></td>
              </tr>
              <tr>
                <td><label htmlFor="email">Email</label></td>
                <td><input id="email" name="email" type="email" required className="os-input" style={{ width: '100%' }} autoComplete="email" /></td>
              </tr>
              <tr>
                <td><label htmlFor="password">Password</label></td>
                <td><input id="password" name="password" type="password" required className="os-input" style={{ width: '100%' }} autoComplete="new-password" /></td>
              </tr>
              <tr>
                <td><label htmlFor="confirmPassword">Confirm</label></td>
                <td><input id="confirmPassword" name="confirmPassword" type="password" required className="os-input" style={{ width: '100%' }} autoComplete="new-password" /></td>
              </tr>
              <tr>
                <td><label htmlFor="alias">Alias</label></td>
                <td><input id="alias" name="alias" required className="os-input" style={{ width: '100%' }} autoComplete="username" /></td>
              </tr>
            </tbody>
          </table>

          <fieldset style={{ border: '1px solid var(--os-border)', marginTop: 12, padding: 10 }}>
            <legend style={{ padding: '0 6px', color: 'var(--os-gold)', fontSize: 13 }}>Select District</legend>
            {districts.map((d) => (
              <label key={d.slug} style={{ display: 'block', marginBottom: 8, cursor: 'pointer' }}>
                <input type="radio" name="districtSlug" value={d.slug} required style={{ marginRight: 8 }} />
                <strong>{d.name}</strong>
                <span style={{ display: 'block', marginLeft: 22, fontSize: 12, color: 'var(--os-text-dim)' }}>{d.description}</span>
              </label>
            ))}
          </fieldset>

          {error && <p style={{ color: 'var(--os-red)', marginTop: 8 }} role="alert">{error}</p>}
          <p style={{ marginTop: 10 }}>
            <button type="submit" className="os-btn os-btn-primary" disabled={loading}>
              {loading ? 'Processing…' : 'Establish Empire'}
            </button>
          </p>
          <p style={{ fontSize: 12 }}>
            Already registered? <Link href="/login" className="os-link">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
