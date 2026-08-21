import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe NextAuth config — used by middleware only.
 * No providers, no database, no bcrypt. Session is read from JWT cookie.
 */
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.AUTH_SECRET,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isAuthPage =
        path.startsWith('/login') ||
        path.startsWith('/register') ||
        path.startsWith('/forgot-password') ||
        path.startsWith('/reset-password');
      const isProtected =
        path.startsWith('/command') ||
        path.startsWith('/empire') ||
        path.startsWith('/operations') ||
        path.startsWith('/underworld') ||
        path.startsWith('/social') ||
        path.startsWith('/scout') ||
        path.startsWith('/produce') ||
        path.startsWith('/shop') ||
        path.startsWith('/businesses') ||
        path.startsWith('/attack') ||
        path.startsWith('/reports') ||
        path.startsWith('/rankings') ||
        path.startsWith('/players') ||
        path.startsWith('/guides') ||
        path.startsWith('/identity') ||
        path.startsWith('/settings') ||
        path.startsWith('/coming') ||
        path.startsWith('/market') ||
        path.startsWith('/cartels') ||
        path.startsWith('/travel') ||
        path.startsWith('/bank') ||
        path.startsWith('/playtest') ||
        path.startsWith('/admin');

      if (isAuthPage) return true;
      if (isProtected) return isLoggedIn;
      return true;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
