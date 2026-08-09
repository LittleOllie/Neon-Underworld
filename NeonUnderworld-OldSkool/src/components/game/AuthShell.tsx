import Link from 'next/link';

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="g-shell g-auth-shell">
      <div className="g-auth-top">
        <Link href="/login" className="g-brand">
          NEON UNDERWORLD
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
