import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@local/lib/auth/auth.config';

const { auth } = NextAuth(authConfig);

/** Edge auth + root redirect — authenticated users skip `/` server render hop. */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === '/') {
    const destination = req.auth?.user ? '/command' : '/login';
    return NextResponse.redirect(new URL(destination, req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/',
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
  ],
};
