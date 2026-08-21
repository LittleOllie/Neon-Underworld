import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { CartelPanel } from '@local/features/cartels/CartelPanel';
import { getCartelPageData } from '@local/server/actions/cartel.actions';
import { devPerf } from '@local/lib/dev-perf';
import { OS_TERMS } from '@local/config/terminology';

export default async function CartelsPage() {
  const { ctx } = await requireGameSession();
  const data = await devPerf('/cartels data', () => getCartelPageData());

  return (
    <>
      <PageTitle icon="cartel">{data.cartel ? `${OS_TERMS.faction} HQ` : OS_TERMS.factions}</PageTitle>
      <div className="g-gameplay-controls g-factions-chrome">
        <CartelPanel {...data} />
      </div>
    </>
  );
}
