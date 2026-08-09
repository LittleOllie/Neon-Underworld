'use client';

import { SessionProvider } from 'next-auth/react';
import { NavigationProgress } from '@local/components/game/NavigationProgress';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NavigationProgress />
      {children}
    </SessionProvider>
  );
}
