export { auth as middleware } from '@local/lib/auth/config';

export const config = {
  matcher: [
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
    '/reports/:path*',
    '/rankings/:path*',
    '/players/:path*',
    '/guides/:path*',
    '/coming/:path*',
  ],
};
