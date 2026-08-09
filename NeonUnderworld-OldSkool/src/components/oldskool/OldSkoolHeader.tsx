import Link from 'next/link';

interface OldSkoolHeaderProps {
  alias?: string;
  district?: string;
  seasonLabel?: string;
  rank?: number;
  online?: boolean;
}

export function OldSkoolHeader({ alias, district, seasonLabel, rank, online }: OldSkoolHeaderProps) {
  return (
    <header className="os-site-header">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 className="os-site-brand">NEON UNDERWORLD</h1>
          <p className="os-site-tagline">OLDSKOOL DISTRICT NETWORK · Browser Edition v0.1</p>
        </div>
        <div className="os-site-status">
          {alias && (
            <p className="player" style={{ margin: 0 }}>
              <strong>{alias}</strong>
              {rank != null && <span className="meta"> · Rank #{rank}</span>}
            </p>
          )}
          {(district || seasonLabel) && (
            <p className="meta" style={{ margin: '1px 0 0' }}>
              {district}
              {district && seasonLabel && ' · '}
              {seasonLabel}
            </p>
          )}
          <p style={{ margin: '3px 0 0', fontSize: 11 }}>
            <span className={online !== false ? 'old-text-green' : 'old-text-dim'}>
              {online !== false ? '● Online' : '○ Offline'}
            </span>
            {' · '}
            <Link href="/empire" className="os-link">Profile</Link>
          </p>
        </div>
      </div>
    </header>
  );
}

export function OldSkoolFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--os-border)',
        padding: '6px 12px',
        fontSize: 10,
        color: 'var(--os-text-muted)',
        textAlign: 'center',
        marginTop: 12,
      }}
    >
      Neon Underworld OldSkool Edition · Shared database with Modern client · Port 3302
    </footer>
  );
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="old-page-title">{children}</h2>;
}
