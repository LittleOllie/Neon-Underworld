'use client';

import Link from 'next/link';

export default function EmpireError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>Empire unavailable</h2>
      <p style={{ fontSize: 13, color: 'var(--os-text-dim)', marginBottom: 12 }}>
        {error.message || 'Something went wrong loading your empire.'}
      </p>
      <p style={{ fontSize: 12, color: 'var(--os-text-muted)', marginBottom: 16 }}>
        If this persists after a refresh, restart the dev server (<code>npm run dev:oldskool</code>)
        and ensure migrations are applied (<code>npm run db:migrate</code>).
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="os-btn os-btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/command" className="os-btn">
          Command
        </Link>
      </div>
    </div>
  );
}
