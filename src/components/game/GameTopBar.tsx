'use client';

import Link from 'next/link';
import { Bell, UserCircle } from 'lucide-react';
import { BrandMark } from '@/components/game/BrandMark';

interface GameTopBarProps {
  alias?: string;
  district?: string;
  seasonLabel?: string;
  seasonDay?: string;
  seasonRemaining?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function GameTopBar({
  alias,
  district,
  seasonLabel,
  seasonDay,
  seasonRemaining,
}: GameTopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <BrandMark size="sm" />
            {seasonLabel && (
              <span className="text-label text-muted-foreground">{seasonLabel}</span>
            )}
          </div>
          {alias && (
            <p className="mt-1 truncate text-[15px] font-medium leading-tight">
              {getGreeting()}, <span className="text-foreground">{alias}</span>
            </p>
          )}
          <p className="mt-0.5 truncate text-xs text-muted">
            {[district, seasonDay, seasonRemaining].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <Link
            href="/empire"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Empire profile"
          >
            <UserCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </header>
  );
}
