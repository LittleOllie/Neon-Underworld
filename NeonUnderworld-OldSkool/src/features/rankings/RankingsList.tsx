import Link from 'next/link';
import { PlayerIdentity } from '@local/components/game/PlayerIdentity';
import { formatRelativeTime } from '@local/lib/game-context';
import {
  RankingsService,
  type RankingsFilter,
} from '@local/server/services/rankings.service';
import { devPerf } from '@local/lib/dev-perf';

function lastSeenLabel(online: boolean, lastSeen: Date | null): string {
  if (online) return 'Online';
  if (!lastSeen) return 'Offline';
  return formatRelativeTime(lastSeen);
}

export async function RankingsList({
  seasonId,
  playerId,
  filter,
}: {
  seasonId: string;
  playerId: string;
  filter: RankingsFilter;
}) {
  const rows = await devPerf('/rankings data', () =>
    RankingsService.getSeasonRankings(seasonId, filter),
  );

  return (
    <>
      {rows.map((p) => {
        const isYou = p.id === playerId;
        const status = lastSeenLabel(p.online, p.lastSeen);

        if (isYou) {
          return (
            <div key={p.id} className="g-rank-row g-rank-you">
              <span className="g-rank-num">#{p.rank}</span>
              <span className="g-rank-name">
                <PlayerIdentity
                  player={{
                    alias: p.alias,
                    avatarId: p.avatarId,
                    aliasNormalized: p.aliasNormalized,
                    cartelTag: p.cartelTag,
                    city: p.city,
                  }}
                  avatarSize="sm"
                  showCartel
                  showCity
                  static
                  suffix="(you)"
                />
              </span>
              <span className="g-rank-worth">${p.netWorth.toLocaleString()}</span>
            </div>
          );
        }

        return (
          <Link
            key={p.id}
            href={`/players/${p.aliasNormalized}`}
            className="g-rank-row g-rank-link"
          >
            <span className="g-rank-num">#{p.rank}</span>
            <span className="g-rank-name">
              <PlayerIdentity
                player={{
                  alias: p.alias,
                  avatarId: p.avatarId,
                  aliasNormalized: p.aliasNormalized,
                  cartelTag: p.cartelTag,
                  city: p.city,
                }}
                avatarSize="sm"
                showCartel
                static
              />
              <span className="g-inbox-meta"> · {status}</span>
            </span>
            <span className="g-rank-worth">${p.netWorth.toLocaleString()}</span>
          </Link>
        );
      })}
    </>
  );
}
