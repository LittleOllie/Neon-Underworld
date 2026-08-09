'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { OldSkoolHeader, OldSkoolFooter } from '@local/components/oldskool/OldSkoolHeader';

interface PublicHomeProps {
  leaders: Array<{ rank: number; alias: string; netWorth: number }>;
  seasonLabel: string;
}

export function PublicHomeLayout({ leaders, seasonLabel, children }: PublicHomeProps & { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <OldSkoolHeader seasonLabel={seasonLabel} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr 220px',
          flex: 1,
          gap: 0,
        }}
        className="os-layout-grid"
      >
        <nav style={{ borderRight: '1px solid var(--os-border)', padding: 8, background: 'var(--os-bg-header)' }} aria-label="Site">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
            <li><Link href="/login" className="os-link">Login</Link></li>
            <li><Link href="/register" className="os-link">Register</Link></li>
            <li><Link href="/rankings" className="os-link">Rankings</Link></li>
            <li><span className="os-coming-soon">Rules — soon</span></li>
            <li><span className="os-coming-soon">Guides — soon</span></li>
          </ul>
        </nav>
        <main style={{ padding: '14px 16px' }}>{children}</main>
        <aside style={{ borderLeft: '1px solid var(--os-border)', padding: 8, background: 'var(--os-bg-header)' }}>
          <div className="os-section">
            <div className="os-section-title">Season Leaders</div>
            <div className="os-section-body" style={{ padding: 6 }}>
              <table className="os-table">
                <thead><tr><th>#</th><th>Player</th><th>NW</th></tr></thead>
                <tbody>
                  {leaders.map((l) => (
                    <tr key={l.rank}>
                      <td>{l.rank}</td>
                      <td>{l.alias}</td>
                      <td>${l.netWorth.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>
      <OldSkoolFooter />
    </div>
  );
}

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
      setError('Invalid credentials. Check your email and password.');
      return;
    }
    router.push('/command');
    router.refresh();
  }

  return (
    <div className="os-section">
      <div className="os-section-title">Operator Login</div>
      <div className="os-section-body">
        <form onSubmit={handleSubmit}>
          <table className="os-table">
            <tbody>
              <tr>
                <td><label htmlFor="email">Email</label></td>
                <td><input id="email" name="email" type="email" required className="os-input" style={{ width: '100%' }} autoComplete="email" /></td>
              </tr>
              <tr>
                <td><label htmlFor="password">Password</label></td>
                <td><input id="password" name="password" type="password" required className="os-input" style={{ width: '100%' }} autoComplete="current-password" /></td>
              </tr>
            </tbody>
          </table>
          {error && <p style={{ color: 'var(--os-red)', marginTop: 8 }} role="alert">{error}</p>}
          <p style={{ marginTop: 10 }}>
            <button type="submit" className="os-btn os-btn-primary" disabled={loading}>
              {loading ? 'Processing…' : 'Enter District Network'}
            </button>
          </p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            Need an account? <Link href="/register" className="os-link">Register with invite</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
