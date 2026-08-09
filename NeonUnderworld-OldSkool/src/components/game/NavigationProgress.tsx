'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'complete'>('idle');
  const prevPath = useRef(pathname);

  useEffect(() => {
    function onNavigateStart(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!anchor || anchor.getAttribute('target') === '_blank') return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http')) return;

      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === pathname) return;

      setPhase('loading');
    }

    document.addEventListener('click', onNavigateStart, true);
    return () => document.removeEventListener('click', onNavigateStart, true);
  }, [pathname]);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    if (phase !== 'loading') return;

    setPhase('complete');
    const timer = window.setTimeout(() => setPhase('idle'), 220);
    return () => window.clearTimeout(timer);
  }, [pathname, phase]);

  if (phase === 'idle') return null;

  return (
    <div
      className={`g-nav-progress${phase === 'loading' ? ' is-loading' : ' is-complete'}`}
      aria-hidden="true"
    />
  );
}
