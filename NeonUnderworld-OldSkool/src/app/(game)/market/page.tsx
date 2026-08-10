import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { MarketPanel } from '@local/features/market/MarketPanel';
import {
  getMarketPageDataFromContext,
  type MarketFilter,
} from '@local/server/actions/market.actions';
import { devPerf } from '@local/lib/dev-perf';

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

function resolveFilter(param: string | undefined): MarketFilter {
  const allowed: MarketFilter[] = ['all', 'weapons', 'rides', 'drugs', 'supplies', 'personnel'];
  return allowed.includes(param as MarketFilter) ? (param as MarketFilter) : 'all';
}

export default async function MarketPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const filter = resolveFilter(params.filter);
  const data = await devPerf('/market data', () => getMarketPageDataFromContext(ctx, filter));

  return (
    <>
      <PageTitle icon="market">Market</PageTitle>
      <MarketPanel {...data} initialFilter={filter} />
    </>
  );
}
