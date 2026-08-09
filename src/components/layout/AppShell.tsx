'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/command', label: 'Command', icon: '⌘' },
  { href: '/empire', label: 'Empire', icon: '◈' },
  { href: '/market', label: 'Market', icon: '◇' },
  { href: '/operations', label: 'Operations', icon: '◎' },
  { href: '/syndicate', label: 'Syndicate', icon: '◆' },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border-subtle safe-area-pb"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs transition-colors duration-200 ${
                active ? 'text-gold' : 'text-muted hover:text-foreground'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-base leading-none" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

interface AppShellProps {
  children: ReactNode;
  showNav?: boolean;
}

export function AppShell({ children, showNav = true }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-background pb-20">
      {children}
      {showNav && <BottomNavigation />}
    </div>
  );
}
