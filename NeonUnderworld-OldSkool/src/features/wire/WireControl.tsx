'use client';

import { usePlayerShell } from '@local/components/game/PlayerShellProvider';
import { WireFab, WirePanel } from './WirePanel';
import { useWirePanel } from './useWirePanel';

export function WireControl() {
  const { stats } = usePlayerShell();
  const wire = useWirePanel({
    cash: stats.cash,
    netWorth: stats.netWorth,
    rank: stats.rank,
    turns: stats.turns,
    turnCap: stats.turnCap,
    workers: stats.workers,
    thugs: stats.thugs,
  });

  return (
    <>
      <WireFab onClick={wire.openPanel} />
      <WirePanel wire={wire} />
    </>
  );
}
