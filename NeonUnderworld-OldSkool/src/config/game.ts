export const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

export const QUICK_ACTIONS = [
  { label: 'Scout', href: '/scout', ready: true },
  { label: 'Operations', href: '/produce', ready: true },
  { label: 'Attack', href: '/attack', ready: true },
  { label: 'City Shop', href: '/shop', ready: true },
  { label: 'Empire', href: '/empire', ready: true },
  { label: 'Reports', href: '/reports', ready: true },
  { label: 'Rankings', href: '/rankings', ready: true },
  { label: 'Businesses', href: '/businesses', ready: true },
] as const;
