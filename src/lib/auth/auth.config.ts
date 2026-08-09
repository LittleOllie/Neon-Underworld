import type { NextAuthConfig } from 'next-auth';

/** Edge-safe NextAuth config — middleware only. No providers or database. */
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/register');
      const isProtected =
        request.nextUrl.pathname.startsWith('/command') ||
        request.nextUrl.pathname.startsWith('/empire') ||
        request.nextUrl.pathname.startsWith('/rankings') ||
        request.nextUrl.pathname.startsWith('/operations') ||
        request.nextUrl.pathname.startsWith('/admin') ||
        request.nextUrl.pathname.startsWith('/players');

      if (isAuthPage) return true;
      if (isProtected) return isLoggedIn;
      return true;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
