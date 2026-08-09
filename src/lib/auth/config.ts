import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Delegated to route handler — middleware only checks session presence
        const { authorizeCredentials } = await import('./authorize');
        return authorizeCredentials(credentials);
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.playerId = user.playerId;
        token.alias = user.alias;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.playerId = token.playerId as string | null;
        session.user.alias = token.alias as string | null;
      }
      return session;
    },
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
});
