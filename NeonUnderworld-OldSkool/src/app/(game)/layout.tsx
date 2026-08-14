import { GameShell } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { devPerf } from '@local/lib/dev-perf';
import { validateProductionEnv } from '@local/lib/env-validation';
import {
  needsAvatarSelection,
  resolvePlayerAvatarId,
} from '@core/lib/game-engine/resolve-player-avatar';

validateProductionEnv();

/** Shared authenticated shell — header and nav persist across game routes. */
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { ctx } = await devPerf('game layout session', () => requireGameSession());
  const stats = await devPerf('game layout stats', () => globalStatsFromContext(ctx));
  const avatarId = resolvePlayerAvatarId(ctx.avatar);
  const avatarPending = needsAvatarSelection(ctx.avatar);

  return (
    <GameShell
      stats={stats}
      avatarId={avatarId}
      avatarPending={avatarPending}
      wireEnabled={ctx.wireEnabled}
    >
      {children}
    </GameShell>
  );
}
