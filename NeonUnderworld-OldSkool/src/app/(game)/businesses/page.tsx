import { requireGameSession } from '@local/lib/game-context';
import { devPerf } from '@local/lib/dev-perf';
import { PageTitle } from '@local/components/game';
import { BusinessesPanel } from '@local/features/businesses/BusinessesPanel';
import { getBusinessesPageDataFromContext } from '@local/server/actions/business.actions';

export default async function BusinessesPage() {
  const { ctx } = await requireGameSession();
  const data = await devPerf('/businesses data', () => getBusinessesPageDataFromContext(ctx));

  return (
    <>
      <PageTitle icon="market">Businesses</PageTitle>
      <div className="g-gameplay-controls g-businesses-chrome">
        <BusinessesPanel initialData={data} />
      </div>
    </>
  );
}
