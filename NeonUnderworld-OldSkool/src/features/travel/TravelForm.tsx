'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import {
  travelAction,
  type TravelPageData,
  type TravelResult,
} from '@local/server/actions/travel.actions';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { TravelPendingOverlay } from '@local/components/game/TravelPendingOverlay';
import { ActionResult } from '@local/components/game/ActionResult';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { Divider } from '@local/components/game/Divider';

type Props = TravelPageData & { initialDestination?: string };

export function TravelForm({ initialDestination, ...props }: Props) {
  const router = useRouter();
  const [data, setData] = useState(props);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TravelResult | null>(null);

  const ridesShort = Math.max(0, data.ridesRequired - data.ridesOwned);
  const turnsShort = data.turnsAvailable < data.turnCost;
  const pendingDestination = loading
    ? data.destinations.find((d) => d.slug === loading)?.name ?? loading
    : null;

  async function handleTravel(slug: string) {
    setLoading(slug);
    setError('');
    const response = await travelAction(slug, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setResult(response.data);
    setData((prev) => ({
      ...prev,
      turnsAvailable: response.data.newTurns,
    }));
    router.refresh();
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
              router.refresh();
            },
          },
        ]}
      />
    );
  }

  return (
    <>
      {pendingDestination && (
        <TravelPendingOverlay destination={pendingDestination} visible />
      )}

      <SectionLabel>CURRENT CITY</SectionLabel>
      <div className="g-area-row g-area-row-selected">
        <div className="g-area-name">{data.currentCity.toUpperCase()}</div>
        <div className="g-area-meta">You are currently operating here.</div>
      </div>

      <Divider />

      <StatRow label="Rides owned" value={data.ridesOwned.toLocaleString()} />
      <StatRow label="Rides required" value={data.ridesRequired.toLocaleString()} />
      <StatRow label="Travel cost" value={`${data.turnCost} turns`} />
      {ridesShort > 0 && (
        <p className="g-note g-note-warn">
          You need {ridesShort} more rides to travel.{' '}
          <Link href="/shop?tab=vehicles&item=ride" className="g-link">
            Shop → Rides
          </Link>
        </p>
      )}

      <Divider />

      <SectionLabel>DESTINATIONS</SectionLabel>
      {error && <p className="g-note g-note-error">{error}</p>}

      {data.destinations.map((dest) => {
        const blocked = ridesShort > 0 || turnsShort;
        const isPending = loading === dest.slug;
        const isHighlighted =
          initialDestination != null && dest.slug === initialDestination.trim().toLowerCase();
        return (
          <div
            key={dest.slug}
            className={`g-area-row${isHighlighted ? ' g-area-row-selected g-area-row-highlight' : ''}`}
          >
            <div className="g-area-name">{dest.name}</div>
            <div className="g-area-meta">
              {dest.description}
              {isHighlighted ? ' · Selected destination' : ''}
            </div>
            <PrimaryButton
              icon="travel"
              disabled={blocked || loading !== null}
              pending={isPending}
              onClick={() => handleTravel(dest.slug)}
            >
              {isPending ? ACTION_PENDING.travel(dest.name) : 'Travel'}
            </PrimaryButton>
          </div>
        );
      })}
    </>
  );
}
