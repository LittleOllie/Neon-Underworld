'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Store,
  Crosshair,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { NAV } from '@/config/game/terminology';

const NAV_ITEMS: Array<{ href: string; label: string; icon: LucideIcon; match: RegExp }> = [
  { href: '/command', label: NAV.command, icon: LayoutDashboard, match: /^\/command/ },
  { href: '/empire', label: NAV.empire, icon: Building2, match: /^\/empire/ },
  { href: '/market', label: NAV.market, icon: Store, match: /^\/market/ },
  { href: '/operations', label: NAV.operations, icon: Crosshair, match: /^\/operations/ },
  { href: '/cartel', label: NAV.cartel, icon: Users, match: /^\/cartel/ },
];

export function GameBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border-subtle bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-1 pt-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match.test(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex min-h-[44px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors duration-200 ${
                active ? 'text-gold' : 'text-muted hover:text-muted-foreground'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className={`h-5 w-5 ${active ? 'stroke-[2.25px]' : 'stroke-[1.75px]'}`}
                aria-hidden
              />
              <span className="text-[10px] font-medium leading-none">{label}</span>
              {active && (
                <span className="absolute bottom-[calc(var(--safe-bottom)+2px)] h-0.5 w-8 rounded-full bg-gold" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
