/** Direct game-action navigation — no abstract categories */

import type { GameIconName } from '@local/config/game-icons';
import { isPlaytestTurnsNavVisible } from '@core/config/game/playtest';

export interface NavItem {
  href: string;
  label: string;
  icon?: GameIconName;
  isMore?: boolean;
}

export const DESKTOP_NAV: NavItem[] = [
  { href: '/command', label: 'Home', icon: 'home' },
  { href: '/empire', label: 'Empire', icon: 'empire' },
  { href: '/scout', label: 'Scout', icon: 'scout' },
  { href: '/produce', label: 'Produce', icon: 'produce' },
  { href: '/shop', label: 'Shop', icon: 'shop' },
  { href: '#more', label: 'More', icon: 'more', isMore: true },
];

export const MOBILE_NAV: NavItem[] = [
  { href: '/command', label: 'Home', icon: 'home' },
  { href: '/empire', label: 'Empire', icon: 'empire' },
  { href: '/scout', label: 'Scout', icon: 'scout' },
  { href: '/produce', label: 'Produce', icon: 'produce' },
  { href: '#more', label: 'More', icon: 'more', isMore: true },
];

export interface MoreNavItem {
  href: string;
  label: string;
  icon?: GameIconName;
  unavailable?: string;
  action?: 'logout';
  /** Optional count badge (e.g. unread reports). */
  badge?: number;
}

export interface MoreMenuSection {
  id: 'actions' | 'underworld' | 'help';
  label: string;
  items: MoreNavItem[];
}

const COMING_SOON = 'COMING SOON' as const;

const PLAYTEST_MORE_ITEM: MoreNavItem = {
  href: '/playtest/turns',
  label: 'Add Turns',
  icon: 'produce',
};

const LOGOUT_ITEM: MoreNavItem = {
  href: '#logout',
  label: 'Logout',
  action: 'logout',
};

/** Grouped MORE menu — counts injected at render time via buildMoreMenuSections. */
export function buildMoreMenuSections(counts?: { unreadReports?: number }): MoreMenuSection[] {
  const unread = counts?.unreadReports ?? 0;

  const sections: MoreMenuSection[] = [
    {
      id: 'actions',
      label: 'Actions',
      items: [
        { href: '/attack', label: 'Attack', icon: 'attack' },
        { href: '/shop', label: 'Shop', icon: 'shop' },
        { href: '/market', label: 'Market', icon: 'market' },
        { href: '/travel', label: 'Travel', icon: 'travel' },
      ],
    },
    {
      id: 'underworld',
      label: 'Underworld',
      items: [
        { href: '/cartels', label: 'Cartels', icon: 'cartel' },
        { href: '/rankings', label: 'Rankings', icon: 'rankings' },
        {
          href: '/reports',
          label: 'Reports',
          icon: 'reports',
          badge: unread > 0 ? unread : undefined,
        },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { href: '/how-to-play', label: 'How to Play', icon: 'guides' },
        { href: '/guides', label: 'Guides', icon: 'guides' },
      ],
    },
  ];

  if (isPlaytestTurnsNavVisible()) {
    sections[0].items.push(PLAYTEST_MORE_ITEM);
  }

  sections[sections.length - 1].items.push(LOGOUT_ITEM);
  return sections;
}

/** @deprecated Use buildMoreMenuSections — kept for tests expecting flat list order. */
export const MORE_ITEMS: MoreNavItem[] = buildMoreMenuSections()
  .flatMap((s) => s.items);

export function navIsActive(pathname: string, href: string): boolean {
  if (href === '#more') return false;
  if (href === '/command') return pathname === '/command';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** @deprecated Hub routes — redirect to home */
export const DEPRECATED_HUB_ROUTES = ['/operations', '/underworld', '/social'] as const;
