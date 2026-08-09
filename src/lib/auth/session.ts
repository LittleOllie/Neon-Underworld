import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { UnauthorizedError } from '@/lib/game-engine/errors';

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session;
}

export async function requirePlayer() {
  const session = await requireAuth();
  if (!session.user.playerId) {
    redirect('/register?step=district');
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== 'ADMIN') {
    redirect('/command');
  }
  return session;
}

export async function getSession() {
  return auth();
}
