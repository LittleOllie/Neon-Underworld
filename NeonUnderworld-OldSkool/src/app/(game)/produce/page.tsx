import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { ProduceForm } from '@local/features/produce/ProduceForm';
import { prisma } from '@core/lib/db/prisma';
import { getBusinessDrugProductionBonus } from '@core/config/game/business-rules';

export default async function ProducePage() {
  const { ctx } = await requireGameSession();

  const drugLabs = await prisma.business.findMany({
    where: { playerId: ctx.id, businessType: 'DRUG_LAB' },
    select: { businessType: true, level: true },
  });
  const drugLabBonus = getBusinessDrugProductionBonus(drugLabs);

  return (
    <>
      <PageTitle icon="produce">Produce</PageTitle>
      <ProduceForm
        initialTurns={ctx.turns}
        thugCount={ctx.thugs}
        prostituteCount={ctx.prostitutes}
        prostituteHappiness={ctx.prostituteHappiness.score}
        thugHappiness={ctx.thugHappiness.score}
        drugLabBonus={drugLabBonus}
      />
    </>
  );
}
