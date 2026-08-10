import type { Metadata, Viewport } from 'next';
import { Providers } from '@local/components/Providers';
import '@local/styles/globals.css';
import '@local/styles/game-typography.css';
import '@local/styles/backgrounds.css';
import '@local/styles/game-simple.css';
import '@local/styles/loading.css';

export const metadata: Metadata = {
  title: 'Neon Underworld — OldSkool Edition',
  description: 'Classic browser strategy interface for Neon Underworld',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Neon Underworld',
  },
};

export const viewport: Viewport = {
  themeColor: '#050506',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="nu-root">
      <body className="nu-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
