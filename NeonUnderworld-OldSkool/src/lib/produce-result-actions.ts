import type { ActionResultAction } from '@local/components/game/ActionResult';

/** Secondary navigation after a successful Operations action. */
export const PRODUCE_RESULT_SECONDARY_ACTIONS: ActionResultAction[] = [
  { label: 'Shop', href: '/shop?tab=supplies', icon: 'shop' },
  { label: 'Empire', href: '/empire', icon: 'empire' },
  { label: 'Home', href: '/command', icon: 'home' },
];
