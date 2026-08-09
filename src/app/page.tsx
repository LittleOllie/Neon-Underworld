import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.playerId) {
    redirect('/command');
  }
  if (session?.user) {
    redirect('/register');
  }
  redirect('/login');
}
