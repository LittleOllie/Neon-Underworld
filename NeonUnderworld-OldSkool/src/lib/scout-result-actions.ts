import type { ActionResultAction } from '@local/components/game/ActionResult';

/** Secondary navigation after a successful Scout action. */
export const SCOUT_RESULT_SECONDARY_ACTIONS: ActionResultAction[] = [
  { label: 'Shop', href: '/shop?tab=supplies', icon: 'shop' },
  { label: 'Produce', href: '/produce', icon: 'produce' },
  { label: 'Home', href: '/command', icon: 'home' },
];
