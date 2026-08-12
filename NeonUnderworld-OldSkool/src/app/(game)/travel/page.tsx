import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { TravelForm } from '@local/features/travel/TravelForm';
import { getTravelPageDataFromContext } from '@local/server/actions/travel.actions';
import { devPerf } from '@local/lib/dev-perf';

interface Props {
  searchParams: Promise<{ destination?: string }>;
}

export default async function TravelPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const data = await devPerf('/travel data', () => getTravelPageDataFromContext(ctx));

  return (
    <>
      <PageTitle icon="travel">Travel</PageTitle>
      <TravelForm {...data} initialDestination={params.destination} />
    </>
  );
}
