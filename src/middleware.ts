export { auth as middleware } from '@/lib/auth/config';

export const config = {
  matcher: ['/command/:path*', '/empire/:path*', '/rankings/:path*', '/operations/:path*', '/admin/:path*', '/players/:path*'],
};
