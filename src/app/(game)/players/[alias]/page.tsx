import { notFound } from 'next/navigation';
import { GameTopBar } from '@/components/game/GameTopBar';
import { StatusPill } from '@/components/game/StatusPill';
import { getPublicProfile } from '@/server/queries/player.queries';
import { TERMS } from '@/config/game/terminology';
import { TrendingUp } from 'lucide-react';

interface Props {
  params: Promise<{ alias: string }>;
}

export default async function PublicProfilePage({ params }: Props) {
  const { alias } = await params;
  const profile = await getPublicProfile(alias);
  if (!profile) notFound();

  return (
    <>
      <GameTopBar
        alias={profile.alias}
        district={profile.district}
        seasonLabel={`Season ${profile.seasonNumber}`}
      />
      <main className="px-4 py-4">
        <div className="mb-2">
          <p className="text-label">Player dossier</p>
          <h1 className="font-display text-2xl font-semibold">{profile.alias}</h1>
          <p className="mt-1 text-sm text-muted">{profile.district}</p>
        </div>

        <div className="panel-elevated mt-4 grid grid-cols-2 gap-4 rounded-2xl p-5">
          <div>
            <p className="text-label">{TERMS.rank}</p>
            <p className="font-mono-figures text-2xl font-medium">#{profile.rank}</p>
          </div>
          <div>
            <p className="text-label">{TERMS.netWorth}</p>
            <p className="font-mono-figures text-2xl font-medium text-gold">
              ${profile.netWorth.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-label">Season joined</p>
            <p className="text-sm">Season {profile.seasonNumber}</p>
          </div>
          <div>
            <p className="text-label">Last active</p>
            <p className="text-sm">
              {profile.lastSeen ? new Date(profile.lastSeen).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        </div>

        <div className="panel mt-4 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <StatusPill variant="purple">{TERMS.cartel}</StatusPill>
            <span className="text-sm text-muted">No affiliation</span>
          </div>
        </div>

        {profile.netWorthTrend.length > 0 && (
          <div className="panel mt-4 rounded-xl p-4">
            <p className="text-label mb-3">Public trend</p>
            <ul className="space-y-2">
              {profile.netWorthTrend.map((t, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{new Date(t.at).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1 font-mono-figures">
                    <TrendingUp className="h-3 w-3 text-purple" aria-hidden />
                    ${t.netWorth.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
