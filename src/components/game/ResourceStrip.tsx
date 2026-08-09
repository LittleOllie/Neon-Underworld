'use client';

import { useEffect, useState } from 'react';
import { Clock, DollarSign, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { TERMS } from '@/config/game/terminology';

interface ResourceStripProps {
  turns: number;
  turnCap: number;
  isAtCap: boolean;
  msUntilNextTurn: number;
  timeUntilNextTurn: string;
  cash: number;
  rank: number;
  rankMovement?: number;
  netWorth: number;
}

export function ResourceStrip({
  turns,
  turnCap,
  isAtCap,
  msUntilNextTurn,
  timeUntilNextTurn: initialCountdown,
  cash,
  rank,
  rankMovement = 0,
  netWorth,
}: ResourceStripProps) {
  const [countdown, setCountdown] = useState(initialCountdown);

  useEffect(() => {
    if (isAtCap) {
      setCountdown('At cap');
      return;
    }
    let remaining = msUntilNextTurn;
    const interval = setInterval(() => {
      remaining = Math.max(0, remaining - 1000);
      if (remaining <= 0) {
        setCountdown('Now');
      } else {
        const s = Math.ceil(remaining / 1000);
        const m = Math.floor(s / 60);
        setCountdown(m > 0 ? `${m}m ${s % 60}s` : `${s}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [msUntilNextTurn, isAtCap]);

  return (
    <section className="panel-elevated rounded-2xl p-4" aria-label="Primary resources">
      <div className="grid grid-cols-3 gap-3">
        {/* Turns — primary */}
        <div className="col-span-3 border-b border-border-subtle pb-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-label flex items-center gap-1.5">
                <Clock className="h-3 w-3" aria-hidden />
                {TERMS.turns}
              </p>
              <p className="font-mono-figures mt-0.5 text-3xl font-medium tracking-tight text-gold">
                {turns.toLocaleString()}
              </p>
            </div>
            <div className="text-right text-xs text-muted">
              <p>Cap {turnCap.toLocaleString()}</p>
              <p>{isAtCap ? 'Storage full' : `Next ${countdown}`}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-label flex items-center gap-1">
            <DollarSign className="h-3 w-3" aria-hidden />
            {TERMS.cash}
          </p>
          <p className="font-mono-figures mt-0.5 text-lg font-medium">${cash.toLocaleString()}</p>
        </div>

        <div>
          <p className="text-label flex items-center gap-1">
            <Trophy className="h-3 w-3" aria-hidden />
            {TERMS.rank}
          </p>
          <p className="font-mono-figures mt-0.5 flex items-center gap-1 text-lg font-medium">
            #{rank}
            {rankMovement !== 0 && (
              <span className={`inline-flex items-center text-xs ${rankMovement < 0 ? 'text-green' : 'text-red'}`}>
                {rankMovement < 0 ? (
                  <TrendingUp className="h-3 w-3" aria-hidden />
                ) : (
                  <TrendingDown className="h-3 w-3" aria-hidden />
                )}
              </span>
            )}
          </p>
        </div>

        <div className="text-right">
          <p className="text-label">{TERMS.netWorth}</p>
          <p className="font-mono-figures mt-0.5 text-sm text-muted-foreground">
            ${netWorth.toLocaleString()}
          </p>
        </div>
      </div>
    </section>
  );
}
