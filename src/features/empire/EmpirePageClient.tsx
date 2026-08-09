'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import {
  Crosshair,
  Heart,
  Activity,
  LayoutGrid,
} from 'lucide-react';
import { GameTopBar } from '@/components/game/GameTopBar';
import { SegmentedControl } from '@/components/game/SegmentedControl';
import { StatusPill } from '@/components/game/StatusPill';
import { ResourceGroup, ResourceRow, TERMS } from '@/components/game/ResourceGroup';
import { ActivityTimeline, type ActivityEvent } from '@/components/game/ActivityTimeline';
import { EmpirePayoutControl } from '@/features/empire/EmpirePayoutControl';
import { LogoutButton } from '@/features/auth/LogoutButton';
import { readinessStatus, readinessVariant } from '@/lib/game/season-display';
import type { PlayerState } from '@/server/queries/player.queries';

type Tab = 'overview' | 'prostitutes' | 'thugs' | 'inventory' | 'activity';

interface EmpirePageClientProps {
  state: PlayerState;
  scouts: Array<{
    id: string;
    district: { name: string };
    prostitutesFound: number;
    thugsFound: number;
    cashEarned: number;
    createdAt: Date;
  }>;
  activity: Array<{
    id: string;
    eventType: string;
    delta: unknown;
    beforeState: unknown;
    afterState: unknown;
    createdAt: Date;
  }>;
}

export function EmpirePageClient({ state, scouts, activity }: EmpirePageClientProps) {
  const [tab, setTab] = useState<Tab>('overview');

  const armed = Math.min(state.thugs, state.glocks + state.uzis * 2 + state.aks * 3);
  const unarmed = Math.max(0, state.thugs - armed);

  const prostituteStatus = readinessStatus(state.prostituteHappiness.score);
  const thugStatus = readinessStatus(state.thugHappiness.score);

  const timelineEvents = useMemo((): ActivityEvent[] => {
    const events: ActivityEvent[] = [];

    for (const s of scouts) {
      events.push({
        id: s.id,
        icon: Crosshair,
        title: `Scouted ${s.district.name}`,
        summary: `+${s.prostitutesFound} ${TERMS.prostitutes.toLowerCase()} · +${s.thugsFound} ${TERMS.thugs.toLowerCase()} · +$${s.cashEarned.toLocaleString()}`,
        time: formatRelativeTime(s.createdAt),
        sortAt: new Date(s.createdAt).getTime(),
        variant: 'scout',
      });
    }

    for (const a of activity) {
      if (a.eventType === 'SCOUT') continue;
      const delta = a.delta as Record<string, number>;
      if (a.eventType === 'PAYOUT_UPDATE') {
        const before = a.beforeState as Record<string, number>;
        const after = a.afterState as Record<string, number>;
        events.push({
          id: a.id,
          icon: Heart,
          title: 'Payout adjusted',
          summary: `Changed from ${before.prostitutePayoutPercent}% to ${after.prostitutePayoutPercent}%`,
          time: formatRelativeTime(a.createdAt),
          sortAt: new Date(a.createdAt).getTime(),
          variant: 'payout',
        });
      } else if (a.eventType === 'PLAYER_REGISTERED') {
        events.push({
          id: a.id,
          icon: LayoutGrid,
          title: 'Empire established',
          summary: 'Account created and initial resources assigned',
          time: formatRelativeTime(a.createdAt),
          sortAt: new Date(a.createdAt).getTime(),
        });
      } else {
        events.push({
          id: a.id,
          icon: Activity,
          title: a.eventType.replace(/_/g, ' ').toLowerCase(),
          summary: Object.entries(delta)
            .map(([k, v]) => `${v >= 0 ? '+' : ''}${v} ${k}`)
            .join(' · ') || 'State updated',
          time: formatRelativeTime(a.createdAt),
          sortAt: new Date(a.createdAt).getTime(),
        });
      }
    }

    return events.sort((a, b) => b.sortAt - a.sortAt).slice(0, 15);
  }, [scouts, activity]);

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'overview', label: 'Overview' },
    { value: 'prostitutes', label: TERMS.prostitutes },
    { value: 'thugs', label: TERMS.thugs },
    { value: 'inventory', label: 'Inventory' },
    { value: 'activity', label: 'Activity' },
  ];

  return (
    <>
      <GameTopBar
        alias={state.alias}
        district={state.district.name}
        seasonLabel={state.seasonDisplay.label}
        seasonDay={state.seasonDisplay.dayLabel}
        seasonRemaining={state.seasonDisplay.remainingLabel}
      />

      <main className="space-y-4 px-4 py-4">
        {/* Summary strip */}
        <div className="panel-elevated grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl p-4 sm:grid-cols-4">
          <SummaryMetric label={TERMS.netWorth} value={`$${state.netWorth.toLocaleString()}`} highlight />
          <SummaryMetric label={TERMS.cash} value={`$${state.cash.toLocaleString()}`} />
          <SummaryMetric label={TERMS.prostitutes} value={state.prostitutes} />
          <SummaryMetric label={TERMS.thugs} value={state.thugs} />
        </div>

        <SegmentedControl options={tabs} value={tab} onChange={setTab} ariaLabel="Empire sections" />

        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="panel rounded-xl p-4">
              <h3 className="text-label mb-3">Empire readiness</h3>
              <div className="flex flex-wrap gap-2">
                <StatusPill variant={readinessVariant(state.prostituteHappiness.score)}>
                  {TERMS.prostitutes}: {prostituteStatus}
                </StatusPill>
                <StatusPill variant={readinessVariant(state.thugHappiness.score)}>
                  {TERMS.thugs}: {thugStatus}
                </StatusPill>
              </div>
              {state.prostituteHappiness.warnings.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {state.prostituteHappiness.warnings.map((w) => (
                    <li key={w} className="text-xs text-amber">{w}</li>
                  ))}
                </ul>
              )}
              {state.thugHappiness.warnings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {state.thugHappiness.warnings.map((w) => (
                    <li key={w} className="text-xs text-amber">{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'prostitutes' && (
          <div className="space-y-3">
            <div className="panel rounded-xl p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-label">{TERMS.prostitutes}</p>
                  <p className="font-mono-figures text-2xl font-medium">{state.prostitutes}</p>
                </div>
                <StatusPill variant={readinessVariant(state.prostituteHappiness.score)}>
                  {state.prostituteHappiness.score}% happiness
                </StatusPill>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <ReadinessCell label={`${TERMS.hash} coverage`} value={Math.round(state.prostituteHappiness.hashReadiness * 100)} />
                <ReadinessCell label={`${TERMS.condoms} coverage`} value={Math.round(state.prostituteHappiness.condomReadiness * 100)} />
                <ReadinessCell label="Protection" value={Math.round(state.prostituteHappiness.protectionReadiness * 100)} />
              </div>
              <div className="mt-5 border-t border-border-subtle pt-4">
                <EmpirePayoutControl initialPayout={state.prostitutePayoutPercent} />
              </div>
            </div>
          </div>
        )}

        {tab === 'thugs' && (
          <div className="panel rounded-xl p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-label">{TERMS.thugs}</p>
                <p className="font-mono-figures text-2xl font-medium">{state.thugs}</p>
              </div>
              <StatusPill variant={readinessVariant(state.thugHappiness.score)}>
                {thugStatus}
              </StatusPill>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-elevated p-3">
                <p className="text-label">Armed</p>
                <p className="font-mono-figures text-lg">{armed}</p>
              </div>
              <div className="rounded-lg bg-surface-elevated p-3">
                <p className="text-label">Unarmed</p>
                <p className={`font-mono-figures text-lg ${unarmed > 0 ? 'text-amber' : ''}`}>{unarmed}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center text-xs">
              <ReadinessCell label="Weapon coverage" value={Math.round(state.thugHappiness.weaponReadiness * 100)} />
              <ReadinessCell label={`${TERMS.beer} status`} value={Math.round(state.thugHappiness.beerReadiness * 100)} />
            </div>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="space-y-3">
            <ResourceGroup title="Weapons">
              <ResourceRow label={TERMS.glocks} value={state.glocks} />
              <ResourceRow label={TERMS.uzis} value={state.uzis} />
              <ResourceRow label={TERMS.aks} value={state.aks} />
            </ResourceGroup>
            <ResourceGroup title="Supplies">
              <ResourceRow label={TERMS.beer} value={state.beer} />
              <ResourceRow label={TERMS.condoms} value={state.condoms} />
            </ResourceGroup>
            <ResourceGroup title="Products">
              <ResourceRow label={TERMS.hash} value={state.hash} />
              <ResourceRow label={TERMS.shrooms} value={state.shrooms} />
              <ResourceRow label={TERMS.coke} value={state.coke} />
              <ResourceRow label={TERMS.heroin} value={state.heroin} />
            </ResourceGroup>
            <ResourceGroup title="Logistics">
              <ResourceRow label={TERMS.rides} value={state.rides} />
            </ResourceGroup>
          </div>
        )}

        {tab === 'activity' && (
          <div className="panel rounded-xl p-4">
            <ActivityTimeline events={timelineEvents} />
          </div>
        )}

        <SessionProvider>
          <LogoutButton />
        </SessionProvider>
      </main>
    </>
  );
}

function SummaryMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-label">{label}</p>
      <p className={`font-mono-figures mt-0.5 text-base font-medium ${highlight ? 'text-gold' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function ReadinessCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-elevated p-2">
      <p className="text-muted">{label}</p>
      <p className={`font-mono-figures mt-0.5 text-sm font-medium ${value < 50 ? 'text-amber' : ''}`}>
        {value}%
      </p>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
