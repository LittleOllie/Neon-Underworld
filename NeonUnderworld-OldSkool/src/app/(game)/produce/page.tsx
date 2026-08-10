import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { ProduceForm } from '@local/features/produce/ProduceForm';

export default async function ProducePage() {
  const { ctx } = await requireGameSession();

  return (
    <>
      <PageTitle icon="produce">Produce</PageTitle>
      <ProduceForm
        initialTurns={ctx.turns}
        thugCount={ctx.thugs}
        prostituteCount={ctx.prostitutes}
        prostituteHappiness={ctx.prostituteHappiness.score}
        thugHappiness={ctx.thugHappiness.score}
      />
    </>
  );
}
