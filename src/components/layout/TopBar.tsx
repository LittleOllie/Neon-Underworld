'use client';

import Link from 'next/link';

interface TopBarProps {
  alias?: string;
  district?: string;
  seasonNumber?: number;
  daysRemaining?: number;
}

export function TopBar({ alias, district, seasonNumber, daysRemaining }: TopBarProps) {
  const greeting = getGreeting();

  return (
    <header className="sticky top-0 z-40 glass border-b border-border-subtle px-4 py-3">
      <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold tracking-widest text-gold">NU</span>
            {seasonNumber && (
              <span className="text-xs text-muted">Season {seasonNumber}</span>
            )}
          </div>
          {alias && (
            <h1 className="mt-0.5 truncate text-base font-medium">
              {greeting}, {alias}
            </h1>
          )}
          {district && (
            <p className="truncate text-xs text-muted">
              {district}
              {daysRemaining !== undefined && ` · ${daysRemaining} days remaining`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-subtle text-muted transition-colors hover:text-foreground"
            aria-label="Notifications"
          >
            <span aria-hidden="true">🔔</span>
          </button>
          <Link
            href="/empire"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-subtle text-muted transition-colors hover:text-foreground"
            aria-label="Profile and empire"
          >
            <span aria-hidden="true">👤</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
