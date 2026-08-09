'use client';

import { useEffect, useState } from 'react';
import { formatTimeUntilNextTurn } from '@/lib/game-engine/turns';

interface TurnsDisplayProps {
  turns: number;
  turnCap: number;
  isAtCap: boolean;
  msUntilNextTurn: number;
}

export function TurnsDisplay({ turns, turnCap, isAtCap, msUntilNextTurn }: TurnsDisplayProps) {
  const [countdown, setCountdown] = useState(formatTimeUntilNextTurn(msUntilNextTurn));

  useEffect(() => {
    if (isAtCap) {
      setCountdown('At cap');
      return;
    }
    let remaining = msUntilNextTurn;
    const interval = setInterval(() => {
      remaining = Math.max(0, remaining - 1000);
      setCountdown(formatTimeUntilNextTurn(remaining));
    }, 1000);
    return () => clearInterval(interval);
  }, [msUntilNextTurn, isAtCap]);

  return (
    <div className="flex-[1.2]">
      <p className="text-xs uppercase tracking-wider text-muted">Turns</p>
      <p className="font-mono-figures text-2xl font-semibold text-gold">{turns.toLocaleString()}</p>
      <p className="text-xs text-muted">
        {isAtCap ? 'Storage full' : `Next in ${countdown}`} · Cap {turnCap.toLocaleString()}
      </p>
    </div>
  );
}
