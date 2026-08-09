import { auth } from '@/lib/auth/config';
import { GameTopBar } from '@/components/game/GameTopBar';
import { ScreenHeader } from '@/components/game/AlphaPreview';
import { OperationItem } from '@/components/game/OperationItem';
import { getPlayerState } from '@/server/queries/player.queries';
import { Crosshair, Factory, Swords, Plane, FileText } from 'lucide-react';
import { TERMS } from '@/config/game/terminology';

export default async function OperationsPage() {
  const session = await auth();
  const state = session?.user?.playerId ? await getPlayerState(session.user.playerId) : null;

  return (
    <>
      {state && (
        <GameTopBar
          alias={state.alias}
          district={state.district.name}
          seasonLabel={state.seasonDisplay.label}
          seasonDay={state.seasonDisplay.dayLabel}
          seasonRemaining={state.seasonDisplay.remainingLabel}
        />
      )}
      <main className="px-4 py-4">
        <ScreenHeader
          title={TERMS.operations}
          subtitle="Scout the district and expand your operation. More operations will open during the alpha."
        />
        <div className="panel mt-4 rounded-2xl py-1">
          <OperationItem
            icon={Crosshair}
            title={TERMS.scout}
            description="Deploy turns to recruit and generate income in your district"
            href="/operations/scout"
            available
          />
          <OperationItem
            icon={Factory}
            title="Produce"
            description="Manufacture hash, shrooms, coke and heroin"
            badge="Upcoming"
            available={false}
          />
          <OperationItem
            icon={Swords}
            title="Attack"
            description="Strike rival operations across the city"
            badge="Upcoming"
            available={false}
          />
          <OperationItem
            icon={Plane}
            title="Travel"
            description="Relocate operations between districts"
            badge="Upcoming"
            available={false}
          />
          <OperationItem
            icon={FileText}
            title="Reports"
            description="Review operation history and intelligence"
            badge="Upcoming"
            available={false}
          />
        </div>
      </main>
    </>
  );
}
