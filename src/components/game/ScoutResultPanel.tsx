'use client';

import Link from 'next/link';
import type { ScoutResultData } from '@/server/actions/scout.actions';
import { TERMS } from '@/config/game/terminology';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ScoutResultPanelProps {
  result: ScoutResultData;
  onScoutAgain: () => void;
}

export function ScoutResultPanel({ result, onScoutAgain }: ScoutResultPanelProps) {
  const items = [
    { label: 'Turns spent', value: result.turnsSpent.toLocaleString() },
    {
      label: TERMS.prostitutes,
      value: `+${result.prostitutesFound}`,
      positive: result.prostitutesFound > 0,
    },
    {
      label: TERMS.thugs,
      value: `+${result.thugsFound}`,
      positive: result.thugsFound > 0,
    },
    {
      label: `${TERMS.cash} earned`,
      value: `$${result.cashEarned.toLocaleString()}`,
      positive: result.cashEarned > 0,
    },
    ...(result.prostitutesLost > 0
      ? [{ label: 'Departures', value: `−${result.prostitutesLost}`, negative: true }]
      : []),
    ...(result.thugsLost > 0
      ? [{ label: `${TERMS.thugs} lost`, value: `−${result.thugsLost}`, negative: true }]
      : []),
    {
      label: TERMS.netWorth,
      value: `${result.netWorthChange >= 0 ? '+' : ''}$${result.netWorthChange.toLocaleString()}`,
      positive: result.netWorthChange > 0,
      negative: result.netWorthChange < 0,
    },
    { label: 'Turns remaining', value: result.newTurns.toLocaleString() },
  ];

  return (
    <div
      className="animate-fade-up space-y-5"
      role="region"
      aria-live="polite"
      aria-label="Scout results"
    >
      <div>
        <p className="text-label text-gold">Scout complete</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
      </div>

      <dl className="panel grid grid-cols-2 gap-4 rounded-2xl p-5">
        {items.map((item, i) => (
          <div
            key={item.label}
            className="animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <dt className="text-label">{item.label}</dt>
            <dd
              className={`font-mono-figures mt-0.5 flex items-center gap-1 text-lg font-medium ${
                'positive' in item && item.positive
                  ? 'text-green'
                  : 'negative' in item && item.negative
                    ? 'text-red'
                    : ''
              }`}
            >
              {item.value}
              {'positive' in item && item.positive && (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              )}
              {'negative' in item && item.negative && (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onScoutAgain}
          className="min-h-[48px] rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-background transition-colors hover:bg-gold-bright"
        >
          Scout again
        </button>
        <Link
          href="/empire"
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-border text-sm font-medium transition-colors hover:border-gold/30"
        >
          View Empire
        </Link>
        <Link
          href="/command"
          className="flex min-h-[44px] items-center justify-center text-sm text-muted hover:text-foreground"
        >
          Return to Command
        </Link>
      </div>
    </div>
  );
}
