import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { AttackForm } from '@local/features/attack/AttackForm';
import { getAttackPageData } from '@local/server/actions/attack.actions';
import { devPerf } from '@local/lib/dev-perf';

interface Props {
  searchParams: Promise<{ reportId?: string; target?: string }>;
}

export default async function AttackPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const data = await devPerf('/attack data', () =>
    getAttackPageData(ctx, {
      targetAlias: params.target,
      reportId: params.reportId,
    }),
  );

  return (
    <>
      <PageTitle icon="attack">Attack</PageTitle>
      <AttackForm
        thugs={data.thugs}
        rides={data.rides}
        glocks={data.glocks}
        uzis={data.uzis}
        aks={data.aks}
        turns={data.turns}
        targets={data.targets}
        initialTargetAlias={data.initialTargetAlias}
        initialReportId={data.initialReportId}
        staleIntelNotice={data.staleIntelNotice}
        attackRangeMinNetWorth={data.attackRangeMinNetWorth}
        intelTurnCost={data.intelTurnCost}
        viewerCity={data.viewerCity}
      />
    </>
  );
}
