import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@local/lib/auth/config';
import { PlayerService, type CanonicalPlayerContext } from '@local/server/services/player.service';
import { RankingsService } from '@local/server/services/rankings.service';
import { ReportService } from '@local/server/services/report.service';
import { EmpireService } from '@local/server/services/empire.service';
import type { GlobalStats } from '@local/components/game/Shell';
import type { AttentionItem } from '@local/lib/attention-items';
import { collectAttentionItems, prioritizeAttentionItems } from '@local/lib/attention-items';

export const requireGameSession = cache(async (): Promise<{
  playerId: string;
  ctx: CanonicalPlayerContext;
}> => {
  const session = await auth();
  if (!session?.user?.playerId) redirect('/login');
  const ctx = await PlayerService.getCanonicalContext(session.user.playerId);
  return { playerId: session.user.playerId, ctx };
});

export async function buildAttentionItems(ctx: CanonicalPlayerContext): Promise<AttentionItem[]> {
  const unreadCount = await ReportService.getUnreadCount(ctx.id);
  const brief = EmpireService.buildCommandBrief(ctx);
  return collectAttentionItems({ ctx, brief, unreadCount });
}

export { prioritizeAttentionItems };

/** @deprecated Sidebar removed — use headerStatsFromContext + buildAttentionItems */
async function buildNotifications(ctx: CanonicalPlayerContext): Promise<AttentionItem[]> {
  return buildAttentionItems(ctx);
}

export function globalStatsFromContext(ctx: CanonicalPlayerContext): GlobalStats {
  return {
    cash: ctx.cash,
    bankCash: ctx.bankCash,
    turns: ctx.turns,
    turnCap: ctx.turnCap,
    netWorth: ctx.netWorth,
    rank: ctx.rank,
    alias: ctx.alias,
    district: ctx.district.name,
  };
}

/** @deprecated Use globalStatsFromContext */
export function headerStatsFromContext(ctx: CanonicalPlayerContext): GlobalStats {
  return globalStatsFromContext(ctx);
}

export async function loadSidebar(ctx: CanonicalPlayerContext) {
  const [leaders, notifications] = await Promise.all([
    RankingsService.getSeasonRankings(ctx.seasonId, 'overall'),
    buildNotifications(ctx),
  ]);
  const topFive = leaders.slice(0, 5);

  return {
    player: {
      alias: ctx.alias,
      city: ctx.district.name,
      turns: ctx.turns,
      turnCap: ctx.turnCap,
      cash: ctx.cash,
      netWorth: ctx.netWorth,
      rank: ctx.rank,
      seasonLabel: ctx.seasonDisplay.label,
      seasonDay: ctx.seasonDisplay.dayLabel,
      daysRemaining: ctx.daysRemaining,
    },
    leaders: topFive.map((p) => ({ rank: p.rank, alias: p.alias, netWorth: p.netWorth })),
    notifications,
    header: {
      alias: ctx.alias,
      district: ctx.district.name,
      seasonLabel: `${ctx.seasonDisplay.label} · ${ctx.seasonDisplay.dayLabel}`,
      rank: ctx.rank,
      online: ctx.online,
    },
  };
}

export function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatLastSeen(date: Date | null): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
