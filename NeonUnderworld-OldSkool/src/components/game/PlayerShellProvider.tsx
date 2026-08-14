'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PlayerShellSnapshot } from '@local/domain/player-shell.model';
import type { GlobalStats } from './GlobalStatus';

function shellToGlobalStats(
  base: GlobalStats,
  shell: Partial<PlayerShellSnapshot>,
): GlobalStats {
  const unreadReports = shell.unreadReports ?? base.attention?.unreadReports ?? 0;
  return {
    ...base,
    cash: shell.cash ?? base.cash,
    turns: shell.turns ?? base.turns,
    turnCap: shell.turnCap ?? base.turnCap,
    netWorth: shell.netWorth ?? base.netWorth,
    rank: shell.rank ?? base.rank,
    district: shell.district ?? base.district,
    workers: shell.workers ?? base.workers,
    thugs: shell.thugs ?? base.thugs,
    attention: {
      unreadReports,
      total: unreadReports,
    },
  };
}

interface PlayerShellContextValue {
  stats: GlobalStats;
  applyShellUpdate: (update: Partial<PlayerShellSnapshot>) => void;
}

const PlayerShellContext = createContext<PlayerShellContextValue | null>(null);

export function PlayerShellProvider({
  initialStats,
  children,
}: {
  initialStats: GlobalStats;
  children: ReactNode;
}) {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  const applyShellUpdate = useCallback((update: Partial<PlayerShellSnapshot>) => {
    setStats((current) => shellToGlobalStats(current, update));
  }, []);

  const value = useMemo(
    () => ({ stats, applyShellUpdate }),
    [stats, applyShellUpdate],
  );

  return (
    <PlayerShellContext.Provider value={value}>{children}</PlayerShellContext.Provider>
  );
}

export function usePlayerShell(): PlayerShellContextValue {
  const ctx = useContext(PlayerShellContext);
  if (!ctx) {
    throw new Error('usePlayerShell must be used within PlayerShellProvider');
  }
  return ctx;
}

/** Safe hook for components that may render outside the game shell. */
export function useOptionalPlayerShell(): PlayerShellContextValue | null {
  return useContext(PlayerShellContext);
}
