import { GameShell, PageTitle } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { ShopForm } from '@local/features/shop/ShopForm';
import { getShopPageDataFromContext } from '@local/server/actions/shop.actions';
import { oldSkoolTabFromParam } from '@local/config/shop-display';

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const data = await getShopPageDataFromContext(ctx);

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="shop">
      <PageTitle icon="shop">Shop</PageTitle>
      <ShopForm {...data} initialTab={oldSkoolTabFromParam(params.tab)} />
    </GameShell>
  );
}
