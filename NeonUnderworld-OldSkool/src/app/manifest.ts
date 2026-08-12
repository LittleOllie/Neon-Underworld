import type { MetadataRoute } from 'next';
import { APP_BRANDING } from '@local/config/app-branding';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_BRANDING.fullName,
    short_name: APP_BRANDING.shortName,
    description: APP_BRANDING.description,
    start_url: '/command',
    display: 'standalone',
    background_color: APP_BRANDING.themeColor,
    theme_color: APP_BRANDING.themeColor,
    orientation: 'portrait',
    icons: [
      {
        src: APP_BRANDING.icons.icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: APP_BRANDING.icons.icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: APP_BRANDING.icons.icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
