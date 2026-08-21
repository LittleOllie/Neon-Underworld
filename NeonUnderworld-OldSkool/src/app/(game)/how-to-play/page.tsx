import { PageTitle } from '@local/components/game';
import { HowToPlayGuide } from '@local/features/guides/HowToPlayGuide';
import { requireGameSession } from '@local/lib/game-context';

export default async function HowToPlayPage() {
  const { ctx } = await requireGameSession();

  return (
    <>
      <PageTitle icon="guides">How to Play</PageTitle>
      <div className="g-gameplay-controls g-guides-chrome">
        <HowToPlayGuide districtName={ctx.district.name} districtSlug={ctx.district.slug} />
      </div>
    </>
  );
}
