'use client';

import { useNavigationTransition } from './NavigationTransitionProvider';

export function NavigationProgress() {
  const { progressPhase } = useNavigationTransition();

  if (progressPhase === 'idle') return null;

  return (
    <div
      className={`g-nav-progress${progressPhase === 'loading' ? ' is-loading' : ' is-complete'}`}
      aria-hidden="true"
    />
  );
}
