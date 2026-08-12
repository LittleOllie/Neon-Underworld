import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import type { GameIconName } from '@local/config/game-icons';

const LIVE_ROUTE_REDIRECTS: Record<string, string> = {
  cartel: '/cartels',
  cartels: '/cartels',
  market: '/market',
  travel: '/travel',
};

const UNAVAILABLE: Record<string, { title: string; reason: string; icon?: GameIconName }> = {
  businesses: { title: 'Businesses', reason: 'Coming soon — business income not yet live.' },
  messages: { title: 'Messages', reason: 'Coming soon.' },
  online: { title: 'Online Players', reason: 'Coming soon.' },
};

interface Props {
  params: Promise<{ feature: string }>;
}

export default async function ComingSoonPage({ params }: Props) {
  const { feature } = await params;
  const liveRoute = LIVE_ROUTE_REDIRECTS[feature];
  if (liveRoute) {
    redirect(liveRoute);
  }

  const meta = UNAVAILABLE[feature] ?? { title: feature, reason: 'Coming soon.' };
  await requireGameSession();

  return (
    <>
      <PageTitle icon={meta.icon}>{meta.title}</PageTitle>
      <p className="g-note g-guide-body">{meta.reason}</p>
      <p className="g-note">
        <Link href="/command">Home</Link>
      </p>
    </>
  );
}
