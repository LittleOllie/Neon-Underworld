'use client';

import { SessionProvider } from 'next-auth/react';
import { BootScreen } from '@local/components/game/BootScreen';
import { NavigationProgress } from '@local/components/game/NavigationProgress';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BootScreen>
        <NavigationProgress />
        {children}
      </BootScreen>
    </SessionProvider>
  );
}
