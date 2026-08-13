/** Authoritative player summary fields shown in the persistent game shell. */
export interface PlayerShellSnapshot {
  cash: number;
  turns: number;
  turnCap: number;
  netWorth: number;
  rank: number;
  district?: string;
  unreadReports?: number;
  /** Workers — updated when poached or scouted. */
  workers?: number;
  /** Street thugs — updated after combat. */
  thugs?: number;
}

export type WithPlayerShell<T> = T & { shell: PlayerShellSnapshot };
