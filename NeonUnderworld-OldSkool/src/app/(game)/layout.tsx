import { GameShell } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';

/** Shared authenticated shell — header and nav persist across game routes. */
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { ctx } = await requireGameSession();

  const stats = await globalStatsFromContext(ctx);
  return <GameShell stats={stats}>{children}</GameShell>;
}
