'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Crosshair,
  Building2,
  Store,
  Swords,
  Plane,
  Lock,
} from 'lucide-react';
import { TERMS } from '@/config/game/terminology';
import type { CommandPresentation } from '@/features/command/recommendations';
import type { CityFeedItem } from '@/features/command/city-feed';

interface CommandCentreProps {
  alias: string;
  district: string;
  seasonDay: string;
  seasonLabel: string;
  turns: number;
  turnCap: number;
  isAtCap: boolean;
  msUntilNextTurn: number;
  cash: number;
  rank: number;
  netWorth: number;
  presentation: CommandPresentation;
  cityFeed: CityFeedItem[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function CommandCentre({
  alias,
  district,
  seasonDay,
  seasonLabel,
  turns,
  turnCap,
  isAtCap,
  msUntilNextTurn,
  cash,
  rank,
  netWorth,
  presentation,
  cityFeed,
}: CommandCentreProps) {
  const [displayTurns, setDisplayTurns] = useState(turns);
  const [countdown, setCountdown] = useState(formatCountdown(msUntilNextTurn, isAtCap));
  const [pulse, setPulse] = useState(false);
  const prevTurns = useRef(turns);

  useEffect(() => {
    if (turns > prevTurns.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      prevTurns.current = turns;
      return () => clearTimeout(t);
    }
    prevTurns.current = turns;
    setDisplayTurns(turns);
  }, [turns]);

  useEffect(() => {
    setDisplayTurns(turns);
  }, [turns]);

  useEffect(() => {
    if (isAtCap) {
      setCountdown('At capacity');
      return;
    }
    let remaining = msUntilNextTurn;
    const interval = setInterval(() => {
      remaining = Math.max(0, remaining - 1000);
      setCountdown(formatCountdown(remaining, false));
      if (remaining <= 0) {
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [msUntilNextTurn, isAtCap]);

  const seasonShort = seasonDay.replace('Day ', 'Day ').replace(' of ', ' · ');

  return (
    <main className="px-5 pb-8 pt-6">
      {/* Identity — quiet, typographic */}
      <header className="mb-10">
        <p className="text-[13px] text-muted">{getGreeting()}</p>
        <h1 className="font-display mt-1 text-[22px] font-semibold tracking-tight">{alias}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{district}</p>
        <p className="mt-0.5 text-[12px] text-muted">
          {seasonShort.split(' · ')[0]} · {seasonLabel}
        </p>
      </header>

      {/* Turns — hero */}
      <section className="mb-8" aria-label="Turn balance">
        <p
          className={`font-mono-figures text-[clamp(4rem,18vw,5.5rem)] font-medium leading-none tracking-tighter text-gold transition-transform duration-300 ${
            pulse ? 'animate-turn-pulse' : ''
          }`}
        >
          {displayTurns.toLocaleString()}
        </p>
        <p className="text-label mt-3">{TERMS.turns}</p>
        <p className="mt-1 text-[12px] text-muted">
          {isAtCap ? 'Storage full' : `Next in ${countdown}`}
          <span className="text-muted/60"> · Cap {turnCap.toLocaleString()}</span>
        </p>
      </section>

      {/* Secondary metrics — one quiet row */}
      <section
        className="mb-10 flex items-baseline justify-between border-y border-border-subtle py-3"
        aria-label="Secondary resources"
      >
        <Metric label={TERMS.cash} value={`$${compactNumber(cash)}`} />
        <Metric label={TERMS.rank} value={`#${rank}`} />
        <Metric label={TERMS.netWorth} value={`$${compactNumber(netWorth)}`} align="right" />
      </section>

      {/* Hero action — only large button */}
      <section className="mb-12" aria-label="Recommended action">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-gold">
            {presentation.status}
          </span>
          <span className="h-px flex-1 bg-border-subtle" aria-hidden />
          <span className="text-[11px] text-muted">{presentation.empireHealth}</span>
        </div>
        <p className="font-display text-[17px] font-medium leading-snug">{presentation.headline}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {presentation.subline}
        </p>
        <Link
          href={presentation.href}
          className="mt-5 flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-gold text-[15px] font-semibold text-background transition-all duration-200 hover:bg-gold-bright active:scale-[0.98]"
        >
          {presentation.cta}
        </Link>
      </section>

      {/* Quick operations — icon grid */}
      <section className="mb-12" aria-label="Quick operations">
        <p className="text-label mb-4">Quick Operations</p>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          <OpTile icon={Crosshair} label={TERMS.scout} sub="Deploy" href="/operations/scout" />
          <OpTile icon={Building2} label={TERMS.empire} sub="Assets" href="/empire" />
          <OpTile icon={Store} label={TERMS.market} sub="Soon" href="/market" muted />
          <OpTile icon={Swords} label="Attack" sub="Locked" locked />
          <OpTile icon={Plane} label="Travel" sub="Locked" locked className="hidden sm:flex" />
        </div>
      </section>

      {/* City feed — dense, terminal-like */}
      {cityFeed.length > 0 && (
        <section aria-label="City feed">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted mb-3">
            City Feed
          </p>
          <ul className="space-y-2">
            {cityFeed.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-[12px] leading-snug">
                <span
                  className={`shrink-0 font-mono text-[11px] ${
                    item.prefix === '▲' ? 'text-gold' : 'text-muted'
                  }`}
                  aria-hidden
                >
                  {item.prefix}
                </span>
                <span className="text-muted-foreground">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  align = 'left',
}: {
  label: string;
  value: string;
  align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="font-mono-figures mt-0.5 text-[13px] font-medium text-muted-foreground">
        {value}
      </p>
    </div>
  );
}

function OpTile({
  icon: Icon,
  label,
  sub,
  href,
  locked,
  muted,
  className = '',
}: {
  icon: typeof Crosshair;
  label: string;
  sub: string;
  href?: string;
  locked?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      <div
        className={`flex aspect-square w-full items-center justify-center rounded-2xl ${
          locked
            ? 'bg-surface/50 text-muted/50'
            : muted
              ? 'bg-surface text-muted'
              : 'bg-surface text-foreground'
        }`}
      >
        {locked ? (
          <Lock className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        ) : (
          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        )}
      </div>
      <p className="mt-2 truncate text-center text-[11px] font-medium">{label}</p>
      <p className="truncate text-center text-[10px] text-muted">{sub}</p>
    </>
  );

  if (href && !locked) {
    return (
      <Link
        href={href}
        className={`flex flex-col items-center transition-opacity hover:opacity-80 active:scale-95 ${className}`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={`flex flex-col items-center opacity-60 ${className}`}>{inner}</div>;
}

function formatCountdown(ms: number, atCap: boolean): string {
  if (atCap) return 'At capacity';
  const s = Math.ceil(ms / 1000);
  if (s <= 0) return 'now';
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s} sec`;
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
