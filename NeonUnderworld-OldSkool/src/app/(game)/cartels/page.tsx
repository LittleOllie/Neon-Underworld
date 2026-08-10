import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { CartelPanel } from '@local/features/cartels/CartelPanel';
import { getCartelPageData } from '@local/server/actions/cartel.actions';
import { devPerf } from '@local/lib/dev-perf';

export default async function CartelsPage() {
  const { ctx } = await requireGameSession();
  const data = await devPerf('/cartels data', () => getCartelPageData(ctx.id));

  return (
    <>
      <PageTitle icon="cartel">Cartels</PageTitle>
      <CartelPanel {...data} />
    </>
  );
}
