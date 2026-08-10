'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/** Dims outgoing page content instantly on tap until the route swap completes. */
export function GameMainTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
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

      setPending(true);
    }

    document.addEventListener('click', onNavigateStart, true);
    return () => document.removeEventListener('click', onNavigateStart, true);
  }, [pathname]);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    setPending(false);
  }, [pathname]);

  return (
    <div className={`g-main-transition${pending ? ' is-pending' : ''}`}>{children}</div>
  );
}
