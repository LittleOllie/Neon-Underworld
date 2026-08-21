'use client';

import { Suspense } from 'react';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { BootScreen } from '@local/components/game/BootScreen';
import { NavigationProgress } from '@local/components/game/NavigationProgress';
import { NavigationTransitionProvider } from '@local/components/game/NavigationTransitionProvider';

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <BootScreen>
        <Suspense fallback={null}>
          <NavigationTransitionProvider>
            <NavigationProgress />
            {children}
          </NavigationTransitionProvider>
        </Suspense>
      </BootScreen>
    </SessionProvider>
  );
}
