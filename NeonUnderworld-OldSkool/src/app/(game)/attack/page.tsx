import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { AttackForm } from '@local/features/attack/AttackForm';
import { getAttackPageData } from '@local/server/actions/attack.actions';
import { directAttackReportId } from '@local/features/attack/direct-attack';
import { devPerf } from '@local/lib/dev-perf';

interface Props {
  searchParams: Promise<{ reportId?: string; target?: string }>;
}

export default async function AttackPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const data = await devPerf('/attack data', () =>
    getAttackPageData(ctx, { targetAlias: params.target }),
  );

  const initialReportId =
    params.reportId ??
    (params.target
      ? data.targets.find(
          (t) => t.reportId === directAttackReportId(params.target!.trim().toLowerCase()),
        )?.reportId
      : undefined);

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
        initialReportId={initialReportId}
        attackRangeMinNetWorth={data.attackRangeMinNetWorth}
      />
    </>
  );
}
