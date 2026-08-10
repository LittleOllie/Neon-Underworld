'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Prefetch a likely next route without rendering a link. */
export function RoutePrefetch({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(href);
  }, [router, href]);

  return null;
}
