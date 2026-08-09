'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { MapPin, Heart, AlertTriangle } from 'lucide-react';
import { scoutAction, type ScoutResultData } from '@/server/actions/scout.actions';
import { GameTopBar } from '@/components/game/GameTopBar';
import { ScreenHeader } from '@/components/game/AlphaPreview';
import { StatusPill } from '@/components/game/StatusPill';
import { TurnAmountSelector } from '@/components/game/TurnAmountSelector';
import { ScoutResultPanel } from '@/components/game/ScoutResultPanel';
import { TERMS } from '@/config/game/terminology';
import { TURNS_CONFIG } from '@/config/game/balance';
import { readinessStatus, readinessVariant } from '@/lib/game/season-display';

interface ScoutPageClientProps {
  alias: string;
  district: string;
  districtDescription: string;
  turns: number;
  prostituteHappiness: number;
  seasonLabel: string;
  seasonDay: string;
  seasonRemaining: string;
}

export function ScoutPageClient({
  alias,
  district,
  districtDescription,
  turns: initialTurns,
  prostituteHappiness,
  seasonLabel,
  seasonDay,
  seasonRemaining,
}: ScoutPageClientProps) {
  const router = useRouter();
  const [turns, setTurns] = useState(initialTurns);
  const [selected, setSelected] = useState<number | null>(100);
  const [customValue, setCustomValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScoutResultData | null>(null);
  const [confirming, setConfirming] = useState(false);

  const effectiveAmount = selected ?? (customValue > 0 ? customValue : 0);
  const riskStatus = prostituteHappiness < 45 ? 'Elevated departure risk' : 'Standard risk';

  async function handleScout() {
    if (effectiveAmount <= 0 || effectiveAmount > turns) {
      setError('Select a valid turn amount');
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    setError('');
    const idempotencyKey = uuidv4();
    const response = await scoutAction(effectiveAmount, idempotencyKey);
    setLoading(false);
    setConfirming(false);

    if (!response.success) {
      setError(response.error);
      return;
    }
    setResult(response.data);
    setTurns(response.data.newTurns);
  }

  if (result) {
    return (
      <>
        <GameTopBar
          alias={alias}
          district={district}
          seasonLabel={seasonLabel}
          seasonDay={seasonDay}
          seasonRemaining={seasonRemaining}
        />
        <main className="px-4 py-4">
          <ScoutResultPanel
            result={result}
            onScoutAgain={() => {
              setResult(null);
              router.refresh();
            }}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <GameTopBar
        alias={alias}
        district={district}
        seasonLabel={seasonLabel}
        seasonDay={seasonDay}
        seasonRemaining={seasonRemaining}
      />
      <main className="space-y-5 px-4 py-4">
        <ScreenHeader title={TERMS.scout} subtitle={district} />

        <div className="panel rounded-xl p-4">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan" strokeWidth={1.75} aria-hidden />
            <p className="text-sm leading-relaxed text-muted-foreground">{districtDescription}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill variant="info">{turns.toLocaleString()} turns available</StatusPill>
          <StatusPill variant={readinessVariant(prostituteHappiness)}>
            <Heart className="mr-1 inline h-3 w-3" aria-hidden />
            {prostituteHappiness}% morale
          </StatusPill>
          {prostituteHappiness < 45 && (
            <StatusPill variant="warning">
              <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />
              {riskStatus}
            </StatusPill>
          )}
        </div>

        <section>
          <ScreenHeader title="Turn allocation" subtitle="Select turns to deploy" />
          <TurnAmountSelector
            values={TURNS_CONFIG.suggestedAmounts}
            selected={selected}
            onSelect={(v) => {
              setSelected(v);
              setCustomValue(0);
              setConfirming(false);
            }}
            max={turns}
            customValue={customValue}
            onCustomChange={(v) => {
              setCustomValue(v);
              setSelected(null);
              setConfirming(false);
            }}
          />
        </section>

        {confirming && (
          <div className="panel rounded-xl p-4" role="status">
            <p className="text-sm font-medium">Confirm scouting deployment</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>Spending {effectiveAmount.toLocaleString()} turns</li>
              <li>Balance after: {(turns - effectiveAmount).toLocaleString()} turns</li>
              <li>District: {district}</li>
              <li>Risk: {riskStatus}</li>
            </ul>
          </div>
        )}

        {error && (
          <p className="text-sm text-red" role="alert">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleScout}
            disabled={loading || effectiveAmount <= 0 || effectiveAmount > turns}
            className="min-h-[48px] w-full rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-background transition-all duration-200 hover:bg-gold-bright active:scale-[0.98] disabled:opacity-50"
          >
            {loading
              ? 'Deploying…'
              : confirming
                ? `Confirm — scout with ${effectiveAmount} turns`
                : `Begin scouting — ${effectiveAmount || '—'} turns`}
          </button>
          {confirming && (
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-[44px] text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      </main>
    </>
  );
}
