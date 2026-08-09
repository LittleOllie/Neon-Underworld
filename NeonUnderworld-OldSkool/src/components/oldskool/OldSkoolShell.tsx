import { GameShell, type GlobalStats } from '@local/components/game';

interface ShellProps {
  headerStats: GlobalStats;
  children: React.ReactNode;
}

/** @deprecated Use GameShell from @local/components/game */
export function OldSkoolShell({ headerStats, children }: ShellProps) {
  return <GameShell stats={headerStats}>{children}</GameShell>;
}
