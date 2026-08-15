'use client';

import { Suspense } from 'react';
import { SessionProvider } from 'next-auth/react';
import { BootScreen } from '@local/components/game/BootScreen';
import { NavigationProgress } from '@local/components/game/NavigationProgress';
import { NavigationTransitionProvider } from '@local/components/game/NavigationTransitionProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
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
