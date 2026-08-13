'use server';

import { auth } from '@local/lib/auth/config';
import type { PlayerShellSnapshot } from '@local/domain/player-shell.model';
import { buildShellSnapshotForPlayer } from '@local/server/services/shell-snapshot.service';

/** Lightweight shell poll — avoids full RSC tree refresh. */
export async function pollPlayerShellAction(): Promise<PlayerShellSnapshot | null> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return null;
  return buildShellSnapshotForPlayer(playerId);
}
