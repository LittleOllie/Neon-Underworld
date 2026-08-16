'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** Removes the static HTML startup splash once React has mounted route content. */
export function StartupSplashDismiss() {
  const pathname = usePathname();
  const dismissed = useRef(false);

  useEffect(() => {
    if (dismissed.current) return;
    dismissed.current = true;

    const splash = document.getElementById('nu-startup-splash');
    if (!splash) return;

    splash.classList.add('nu-startup-splash--hide');
    document.documentElement.classList.remove('nu-startup-pending');

    const timer = window.setTimeout(() => {
      splash.remove();
    }, 180);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
