'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const IDENTITY_PREFIX = '/identity';

export function IdentityGate({
  avatarPending,
  children,
}: {
  avatarPending: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const onIdentityRoute = pathname.startsWith(IDENTITY_PREFIX);

  useEffect(() => {
    if (avatarPending && !onIdentityRoute) {
      router.replace('/identity/select');
    }
  }, [avatarPending, onIdentityRoute, router]);

  if (avatarPending && !onIdentityRoute) {
    return null;
  }

  return children;
}
