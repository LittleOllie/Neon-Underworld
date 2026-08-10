/** Direct game-action navigation — no abstract categories */

import type { GameIconName } from '@local/config/game-icons';

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
  { href: '/rankings', label: 'Rankings', icon: 'rankings' },
  { href: '#more', label: 'More', icon: 'more', isMore: true },
];

export const MOBILE_NAV: NavItem[] = [
  { href: '/command', label: 'Home', icon: 'home' },
  { href: '/empire', label: 'Empire', icon: 'empire' },
  { href: '/scout', label: 'Scout', icon: 'scout' },
  { href: '/rankings', label: 'Rankings', icon: 'rankings' },
  { href: '#more', label: 'More', icon: 'more', isMore: true },
];

export interface MoreNavItem {
  href: string;
  label: string;
  icon?: GameIconName;
  unavailable?: string;
  action?: 'logout';
}

const PLAYTEST_MORE_ITEM: MoreNavItem = {
  href: '/playtest/turns',
  label: 'Add Turns',
  icon: 'produce',
};

const CORE_MORE_ITEMS: MoreNavItem[] = [
  { href: '/how-to-play', label: 'How to Play', icon: 'guides' },
  { href: '/reports', label: 'Reports', icon: 'reports' },
  { href: '/guides', label: 'Guides', icon: 'guides' },
  { href: '/attack', label: 'Attack', icon: 'attack' },
  { href: '/produce', label: 'Produce', icon: 'produce' },
  { href: '/shop', label: 'Shop', icon: 'shop' },
  { href: '/rankings', label: 'Rankings', icon: 'rankings' },
  { href: '/travel', label: 'Travel', icon: 'travel' },
  { href: '/market', label: 'Market', icon: 'market' },
  { href: '/cartels', label: 'Cartels', icon: 'cartel' },
  { href: '#logout', label: 'Logout', action: 'logout' },
];

/** More menu entries — playtest link only when NEXT_PUBLIC_PLAYTEST_TURNS=true */
export const MORE_ITEMS: MoreNavItem[] = [
  ...CORE_MORE_ITEMS.slice(0, 4),
  ...(process.env.NEXT_PUBLIC_PLAYTEST_TURNS === 'true' ? [PLAYTEST_MORE_ITEM] : []),
  ...CORE_MORE_ITEMS.slice(4),
];

export function navIsActive(pathname: string, href: string): boolean {
  if (href === '#more') return false;
  if (href === '/command') return pathname === '/command';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** @deprecated Hub routes — redirect to home */
export const DEPRECATED_HUB_ROUTES = ['/operations', '/underworld', '/social'] as const;
