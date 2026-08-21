import NextAuth from 'next-auth';
import { authConfig } from '@local/lib/auth/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    '/command',
    '/command/:path*',
    '/empire/:path*',
    '/operations/:path*',
    '/underworld/:path*',
    '/social/:path*',
    '/scout/:path*',
    '/produce/:path*',
    '/shop/:path*',
    '/bank/:path*',
    '/attack/:path*',
    '/travel/:path*',
    '/market/:path*',
    '/businesses',
    '/businesses/:path*',
    '/cartels/:path*',
    '/reports/:path*',
    '/rankings/:path*',
    '/players/:path*',
    '/identity/:path*',
    '/settings/:path*',
    '/guides',
    '/how-to-play',
    '/coming/:path*',
    '/playtest/:path*',
    '/admin/:path*',
  ],
};
