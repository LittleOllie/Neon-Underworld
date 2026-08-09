import Link from 'next/link';
import { GameShell, PageTitle } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import type { GameIconName } from '@local/config/game-icons';

const UNAVAILABLE: Record<string, { title: string; reason: string; icon?: GameIconName }> = {
  travel: { title: 'Travel', reason: 'Coming soon — travel mechanics not yet live.', icon: 'travel' },
  market: { title: 'Market', reason: 'Coming soon — player auctions not yet live.', icon: 'market' },
  cartel: { title: 'Cartel', reason: 'Coming soon — cartel systems not yet live.', icon: 'cartel' },
  businesses: { title: 'Businesses', reason: 'Coming soon — business income not yet live.' },
  messages: { title: 'Messages', reason: 'Coming soon.' },
  online: { title: 'Online Players', reason: 'Coming soon.' },
};

interface Props {
  params: Promise<{ feature: string }>;
}

export default async function ComingSoonPage({ params }: Props) {
  const { feature } = await params;
  const meta = UNAVAILABLE[feature] ?? { title: feature, reason: 'Coming soon.' };
  const { ctx } = await requireGameSession();

  return (
    <GameShell stats={globalStatsFromContext(ctx)}>
      <PageTitle icon={meta.icon}>{meta.title}</PageTitle>
      <p className="g-note g-guide-body">{meta.reason}</p>
      <p className="g-note">
        <Link href="/command">Home</Link>
      </p>
    </GameShell>
  );
}
