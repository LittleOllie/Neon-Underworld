'use client';

import { useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import { useMutationLock } from '@local/hooks/useMutationLock';
import {
  travelAction,
  type TravelPageData,
  type TravelResult,
} from '@local/server/actions/travel.actions';
import { ridesRequiredForTravel, travelCrewPopulation } from '@core/lib/game-engine/travel';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { TravelPendingOverlay } from '@local/components/game/TravelPendingOverlay';
import { ActionResult } from '@local/components/game/ActionResult';
import { SelectableCard } from '@local/components/game/SelectableCard';
import { FeedbackNote } from '@local/components/game/FeedbackNote';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { Divider } from '@local/components/game/Divider';

type Props = TravelPageData & { initialDestination?: string };

export function TravelForm({ initialDestination, ...props }: Props) {
  const reconcile = useGameplayReconcile();
  const { locked, pendingKey, run } = useMutationLock();
  const [data, setData] = useState(props);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TravelResult | null>(null);

  const loading = pendingKey;

  const ridesShort = Math.max(0, data.ridesRequired - data.ridesOwned);
  const turnsShort = data.turnsAvailable < data.turnCost;
  const pendingDestination = loading
    ? data.destinations.find((d) => d.slug === loading)?.name ?? loading
    : null;

  async function handleTravel(slug: string) {
    await run(slug, async () => {
      setError('');
      const response = await travelAction(slug, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      setResult(response.data);
      setData((prev) => {
        const shell = response.data.shell;
        const crew =
          shell?.thugs != null && shell.workers != null
            ? travelCrewPopulation(shell.thugs, shell.workers)
            : prev.crewPopulation;
        const rides = shell?.rides ?? prev.ridesOwned;
        return {
          ...prev,
          turnsAvailable: response.data.newTurns,
          currentCity: response.data.destinationName,
          currentSlug: response.data.destinationSlug,
          ridesOwned: rides,
          ridesRequired: ridesRequiredForTravel(crew),
          crewPopulation: crew,
        };
      });
      reconcile(response.data.shell);
    });
  }

  if (result) {
    return (
      <ActionResult
        title="Travel Complete"
        lines={[
          { text: result.message, tone: 'positive' },
          { text: `${result.turnsSpent} turns used` },
          { text: `${result.newTurns} turns remaining` },
        ]}
        actions={[
          {
            label: 'Travel Again',
            primary: true,
            icon: 'travel',
            onClick: () => {
              setResult(null);
            },
          },
        ]}
      />
    );
  }

  return (
    <div aria-busy={locked || undefined}>
      {pendingDestination && (
        <TravelPendingOverlay destination={pendingDestination} visible />
      )}

      <SectionLabel>CURRENT CITY</SectionLabel>
      <SelectableCard
        as="div"
        title={data.currentCity.toUpperCase()}
        meta="You are currently operating here."
        selected
        selectedLabel="Current"
      />

      <Divider />

      <StatRow label="Rides owned" value={data.ridesOwned.toLocaleString()} />
      <StatRow label="Rides required" value={data.ridesRequired.toLocaleString()} />
      <StatRow label="Travel cost" value={`${data.turnCost} turns`} />
      {ridesShort > 0 && (
        <FeedbackNote tone="warn">
          You need {ridesShort} more rides to travel.{' '}
          <Link href="/shop?tab=vehicles&item=ride" className="g-link">
            Shop → Rides
          </Link>
        </FeedbackNote>
      )}

      <Divider />

      <SectionLabel>DESTINATIONS</SectionLabel>
      {error && <FeedbackNote tone="error">{error}</FeedbackNote>}

      {data.destinations.map((dest) => {
        const blocked = ridesShort > 0 || turnsShort;
        const isPending = loading === dest.slug;
        const isHighlighted =
          initialDestination != null && dest.slug === initialDestination.trim().toLowerCase();
        return (
          <SelectableCard
            key={dest.slug}
            as="div"
            title={dest.name}
            meta={
              <>
                {dest.description}
                {isHighlighted ? ' · Selected destination' : ''}
              </>
            }
            selected={isHighlighted}
            highlighted={isHighlighted}
          >
            <PrimaryButton
              icon="travel"
              disabled={blocked || locked}
              pending={isPending}
              onClick={() => handleTravel(dest.slug)}
            >
              {isPending ? ACTION_PENDING.travel(dest.name) : 'Travel'}
            </PrimaryButton>
          </SelectableCard>
        );
      })}
    </div>
  );
}
