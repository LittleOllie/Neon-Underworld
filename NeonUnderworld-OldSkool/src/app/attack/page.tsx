import { GameShell, PageTitle } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { AttackForm } from '@local/features/attack/AttackForm';
import { getAttackPageData } from '@local/server/actions/attack.actions';

interface Props {
  searchParams: Promise<{ reportId?: string }>;
}

export default async function AttackPage({ searchParams }: Props) {
  const params = await searchParams;
  const { playerId, ctx } = await requireGameSession();
  const data = await getAttackPageData(playerId);

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="attack">
      <PageTitle icon="attack">Attack</PageTitle>
      <AttackForm
        thugs={data.thugs}
        rides={data.rides}
        glocks={data.glocks}
        uzis={data.uzis}
        aks={data.aks}
        turns={data.turns}
        targets={data.targets}
        initialReportId={params.reportId}
      />
    </GameShell>
  );
}
