import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@local/lib/auth/config';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') {
    redirect('/login?error=admin_required');
  }

  return (
    <div className="g-admin">
      <header className="g-admin__header">
        <div>
          <p className="g-admin__eyebrow">Operator</p>
          <h1 className="g-admin__title">Admin Dashboard</h1>
        </div>
        <nav className="g-admin__nav" aria-label="Admin sections">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/players">Players</Link>
          <Link href="/admin/analytics">Analytics</Link>
          <Link href="/admin/rounds">Rounds</Link>
          <Link href="/command">← Game</Link>
        </nav>
      </header>
      <main className="g-admin__main">{children}</main>
    </div>
  );
}
