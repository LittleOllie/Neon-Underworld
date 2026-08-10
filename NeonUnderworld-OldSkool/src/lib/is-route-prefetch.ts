import { headers } from 'next/headers';

/** True when Next.js is prefetching route RSC data (not a user navigation). */
export async function isRoutePrefetch(): Promise<boolean> {
  const h = await headers();
  if (h.get('Next-Router-Prefetch') === '1') return true;
  if (h.get('Purpose') === 'prefetch') return true;
  if (h.get('Sec-Purpose') === 'prefetch') return true;

  const dest = h.get('Sec-Fetch-Dest');
  const mode = h.get('Sec-Fetch-Mode');
  if (dest === 'empty' && mode === 'cors' && h.has('Next-Url')) return true;

  return false;
}
