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

export const MORE_ITEMS: MoreNavItem[] = [
  { href: '/how-to-play', label: 'How to Play', icon: 'guides' },
  { href: '/reports', label: 'Reports', icon: 'reports' },
  { href: '/guides', label: 'Guides', icon: 'guides' },
  { href: '/produce', label: 'Produce', icon: 'produce' },
  { href: '/shop', label: 'Shop', icon: 'shop' },
  { href: '/rankings', label: 'Rankings', icon: 'rankings' },
  { href: '/playtest/turns', label: 'Add Turns', icon: 'produce' },
  { href: '/coming/market', label: 'Market', icon: 'market', unavailable: 'Coming Soon' },
  { href: '/coming/travel', label: 'Travel', icon: 'travel', unavailable: 'Coming Soon' },
  { href: '/coming/cartel', label: 'Cartel', icon: 'cartel', unavailable: 'Coming Soon' },
  { href: '#logout', label: 'Logout', action: 'logout' },
];

export function navIsActive(pathname: string, href: string): boolean {
  if (href === '#more') return false;
  if (href === '/command') return pathname === '/command';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** @deprecated Hub routes — redirect to home */
export const DEPRECATED_HUB_ROUTES = ['/operations', '/underworld', '/social'] as const;
