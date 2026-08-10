import { PageTitle } from '@local/components/game';
import { RoutePrefetch } from '@local/components/game/RoutePrefetch';
import { requireGameSession } from '@local/lib/game-context';
import { EmpireService } from '@local/server/services/empire.service';
import { EmpireSimpleView } from '@local/features/empire/EmpireSimpleView';
import { devPerf } from '@local/lib/dev-perf';

export default async function EmpirePage() {
  const { ctx } = await requireGameSession();
  const data = await devPerf('/empire data', () => EmpireService.getManagementDataFromContext(ctx));

  return (
    <>
      <RoutePrefetch href="/shop" />
      <PageTitle icon="empire">Empire</PageTitle>
      <EmpireSimpleView data={data} />
    </>
  );
}
