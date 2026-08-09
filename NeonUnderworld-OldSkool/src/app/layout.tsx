import type { Metadata } from 'next';
import { Providers } from '@local/components/Providers';
import '@local/styles/globals.css';
import '@local/styles/game-typography.css';
import '@local/styles/backgrounds.css';
import '@local/styles/game-simple.css';

export const metadata: Metadata = {
  title: 'Neon Underworld — OldSkool Edition',
  description: 'Classic browser strategy interface for Neon Underworld',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
