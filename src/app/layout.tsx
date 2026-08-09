import type { Metadata, Viewport } from 'next';
import { Manrope, Inter, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';

const display = Manrope({
  variable: '--font-display-fallback',
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
});

const ui = Inter({
  variable: '--font-ui-fallback',
  subsets: ['latin'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  variable: '--font-mono-fallback',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Neon Underworld',
  description: 'The operating system of a modern criminal empire',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080809',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
