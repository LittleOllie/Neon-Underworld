import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { GameTopBar } from '@/components/game/GameTopBar';
import { ScreenHeader } from '@/components/game/AlphaPreview';
import { getPlayerState, getRankings, getActiveSeason } from '@/server/queries/player.queries';
import { TERMS } from '@/config/game/terminology';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default async function RankingsPage() {
  const session = await auth();
  if (!session?.user?.playerId) redirect('/login');

  const state = await getPlayerState(session.user.playerId);
  const season = await getActiveSeason();
  if (!season) {
    return (
      <main className="px-4 py-12 text-center text-sm text-muted">
        No active season. Rankings will appear when a season begins.
      </main>
    );
  }

  const { items } = await getRankings(season.id, 1, 50);
  const currentPlayer = items.find((p) => p.id === session.user.playerId);

  return (
    <>
      {state && (
        <GameTopBar
          alias={state.alias}
          district={state.district.name}
          seasonLabel={state.seasonDisplay.label}
          seasonDay={state.seasonDisplay.dayLabel}
          seasonRemaining={state.seasonDisplay.remainingLabel}
        />
      )}

      <main className="px-4 py-4">
        <ScreenHeader title="Rankings" subtitle={`${state?.seasonDisplay.label} · ${state?.seasonDisplay.dayLabel}`} />

        {currentPlayer && (
          <div className="hero-panel mb-4 flex items-center justify-between rounded-xl px-4 py-3">
            <div>
              <p className="text-label">Your position</p>
              <p className="font-mono-figures text-lg font-medium">
                #{currentPlayer.rank} · {currentPlayer.alias}
              </p>
            </div>
            <p className="font-mono-figures text-sm text-gold">
              ${currentPlayer.netWorth.toLocaleString()}
            </p>
          </div>
        )}

        <div className="panel overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="px-3 py-2.5 text-label">#</th>
                <th className="px-3 py-2.5 text-label">Alias</th>
                <th className="hidden px-3 py-2.5 text-label sm:table-cell">District</th>
                <th className="px-3 py-2.5 text-right text-label">{TERMS.netWorth}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const isCurrent = p.id === session.user.playerId;
                const isTopThree = p.rank <= 3;
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-border-subtle last:border-0 transition-colors ${
                      isCurrent ? 'bg-gold-muted' : isTopThree ? 'bg-surface-elevated/50' : ''
                    }`}
                  >
                    <td className="px-3 py-3 font-mono-figures text-muted">{p.rank}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/players/${p.aliasNormalized}`}
                        className={`hover:text-gold ${isCurrent ? 'font-semibold text-gold' : ''}`}
                      >
                        {p.alias}
                        {isCurrent && <span className="ml-2 text-xs text-gold">(you)</span>}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-3 text-muted sm:table-cell">{p.district}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-mono-figures">${p.netWorth.toLocaleString()}</span>
                      {p.netWorthMovement !== 0 && (
                        <span
                          className={`ml-1 inline-flex items-center text-xs ${
                            p.netWorthMovement > 0 ? 'text-green' : 'text-red'
                          }`}
                        >
                          {p.netWorthMovement > 0 ? (
                            <TrendingUp className="h-3 w-3" aria-hidden />
                          ) : (
                            <TrendingDown className="h-3 w-3" aria-hidden />
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
