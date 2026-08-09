import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    '/command/:path*',
    '/empire/:path*',
    '/rankings/:path*',
    '/operations/:path*',
    '/admin/:path*',
    '/players/:path*',
  ],
};
