import Link from 'next/link';
import { NuBackground } from '@local/components/game/NuBackground';
import { NuBrandLogo } from '@local/components/game/NuBrandLogo';

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="g-shell g-auth-shell g-auth-shell--nu">
      <NuBackground background="intro" priority />
      <div className="g-auth-top">
        <Link href="/login" className="g-auth-brand-link" aria-label="Neon Underworld">
          <NuBrandLogo size="md" priority />
        </Link>
      </div>
      <main className="g-auth-main">
        <div className="g-auth-card">
          <h1 className="g-auth-title">{title}</h1>
          {children}
        </div>
      </main>
      <footer className="g-footer">Neon Underworld · OldSkool Edition</footer>
    </div>
  );
}
