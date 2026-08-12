/** Authoritative player summary fields shown in the persistent game shell. */
export interface PlayerShellSnapshot {
  cash: number;
  turns: number;
  turnCap: number;
  netWorth: number;
  rank: number;
  district?: string;
  unreadReports?: number;
}

export type WithPlayerShell<T> = T & { shell: PlayerShellSnapshot };
