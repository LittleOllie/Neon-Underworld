import { GameShell } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { devPerf } from '@local/lib/dev-perf';
import { validateProductionEnv } from '@local/lib/env-validation';
import { needsIdentitySetup } from '@core/lib/game-engine/player-identity';

validateProductionEnv();

/** Shared authenticated shell — header and nav persist across game routes. */
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { ctx } = await devPerf('game layout session', () => requireGameSession());
  const stats = await devPerf('game layout stats', () => globalStatsFromContext(ctx));
  const identityPending = needsIdentitySetup(ctx);

  return (
    <GameShell
      stats={stats}
      playerIdentity={ctx}
      identityPending={identityPending}
      wireEnabled={ctx.wireEnabled}
    >
      {children}
    </GameShell>
  );
}
