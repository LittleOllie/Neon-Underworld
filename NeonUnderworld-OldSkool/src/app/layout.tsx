import type { Metadata, Viewport } from 'next';
import { Providers } from '@local/components/Providers';
import { APP_BRANDING } from '@local/config/app-branding';
import '@local/styles/globals.css';
import '@local/styles/game-typography.css';
import '@local/styles/backgrounds.css';
import '@local/styles/game-simple.css';
import '@local/styles/loading.css';

export const metadata: Metadata = {
  title: 'Neon Underworld — OldSkool Edition',
  description: APP_BRANDING.description,
  icons: {
    icon: [
      { url: APP_BRANDING.icons.favicon32, sizes: '32x32', type: 'image/png' },
      { url: APP_BRANDING.icons.icon192, sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: APP_BRANDING.icons.appleTouch, sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_BRANDING.shortName,
  },
};

export const viewport: Viewport = {
  themeColor: APP_BRANDING.themeColor,
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
