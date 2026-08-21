import { signOut } from '@local/lib/auth/config';

/** Clears a JWT whose playerId is missing from the current database. */
export async function GET() {
  return signOut({ redirectTo: '/login' });
}
