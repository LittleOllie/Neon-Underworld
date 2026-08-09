'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Refreshes server-rendered unread counts after report detail marks read on the server. */
export function ReportReadSync({ wasUnread }: { wasUnread: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (wasUnread) {
      router.refresh();
    }
  }, [wasUnread, router]);

  return null;
}
