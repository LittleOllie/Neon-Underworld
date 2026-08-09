'use client';

import type { ReactNode } from 'react';
import { GameBottomNav } from '@/components/game/GameBottomNav';

interface GameAppShellProps {
  children: ReactNode;
  showNav?: boolean;
}

export function GameAppShell({ children, showNav = true }: GameAppShellProps) {
  return (
    <div className="game-shell-bg min-h-dvh pb-nav-safe">
      <div className="mx-auto min-h-dvh max-w-2xl lg:max-w-4xl">{children}</div>
      {showNav && <GameBottomNav />}
    </div>
  );
}
