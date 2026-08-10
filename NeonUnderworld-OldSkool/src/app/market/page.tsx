import { GameShell, PageTitle } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { MarketPanel } from '@local/features/market/MarketPanel';
import {
  getMarketPageDataFromContext,
  type MarketFilter,
} from '@local/server/actions/market.actions';

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

function resolveFilter(param: string | undefined): MarketFilter {
  const allowed: MarketFilter[] = ['all', 'weapons', 'rides', 'drugs', 'supplies'];
  return allowed.includes(param as MarketFilter) ? (param as MarketFilter) : 'all';
}

export default async function MarketPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const filter = resolveFilter(params.filter);
  const data = await getMarketPageDataFromContext(ctx, filter);

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="market">
      <PageTitle icon="market">Market</PageTitle>
      <MarketPanel {...data} initialFilter={filter} />
    </GameShell>
  );
}
