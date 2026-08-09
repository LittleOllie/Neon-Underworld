/** Canonical player model for OldSkool — all pages consume this shape */
export type PlayerLifeStatus = 'ACTIVE' | 'TRAVELLING' | 'HOSPITALIZED' | 'JAIL' | 'INACTIVE';
export type ProtectionLevel = 'NONE' | 'STANDARD' | 'PREMIUM';
/** @deprecated Use ActivityType from @local/config/activity-types */
export type ActivityCategoryType = import('@local/config/activity-types').ActivityType;

export interface PlayerModel {
  id: string;
  username: string;
  avatar: string | null;
  city: string;
  citySlug: string;
  cartelId: string | null;
  cartelName: string | null;
  rank: number;
  netWorth: number;
  cash: number;
  bankCash: number;
  turns: number;
  maxTurns: number;
  turnsLastUpdated: Date;
  health: number;
  status: PlayerLifeStatus;
  travelling: boolean;
  travelDestination: string | null;
  travelArrival: Date | null;
  protectionStatus: ProtectionLevel;
  online: boolean;
  lastSeen: Date | null;
  seasonLabel: string;
  seasonDay: string;
  roundNumber: number;
}

export interface EmpireSummary {
  thugs: number;
  workers: number;
  weapons: number;
  vehicles: number;
  drugs: number;
  businesses: number;
}

export interface ActivityItem {
  id: string;
  category: string;
  message: string;
  createdAt: Date;
}

export interface ReportPreview {
  id: string;
  category: string;
  title: string;
  summary: string;
  read: boolean;
  createdAt: Date;
}

export interface OnlinePlayer {
  username: string;
  city: string;
  rank: number;
  lastSeen: Date | null;
  online: boolean;
}

import type { CommandEmpireBrief } from '@local/domain/empire.model';

export interface CommandPageData {
  player: PlayerModel;
  empire: EmpireSummary;
  empireBrief: CommandEmpireBrief;
  activities: ActivityItem[];
  reports: ReportPreview[];
  unreadReportCount: number;
  notification: string | null;
  onlinePlayers: OnlinePlayer[];
}
