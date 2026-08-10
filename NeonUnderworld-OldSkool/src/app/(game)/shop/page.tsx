import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { ShopForm } from '@local/features/shop/ShopForm';
import { getShopPageDataFromContext } from '@local/server/actions/shop.actions';
import { resolveShopPageParams } from '@local/config/shop-display';
import { devPerf } from '@local/lib/dev-perf';

interface Props {
  searchParams: Promise<{ tab?: string; item?: string }>;
}

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const data = await devPerf('/shop data', () => getShopPageDataFromContext(ctx));
  const { initialTab, highlightItem } = resolveShopPageParams(params.tab, params.item);

  return (
    <>
      <PageTitle icon="shop">Shop</PageTitle>
      <ShopForm {...data} initialTab={initialTab} highlightItem={highlightItem} />
    </>
  );
}
