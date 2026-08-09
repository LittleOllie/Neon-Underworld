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
        const { authorizeCredentials } = await import('@core/lib/auth/authorize');
        return authorizeCredentials(credentials);
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
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
      const path = request.nextUrl.pathname;
      const isAuthPage = path.startsWith('/login') || path.startsWith('/register');
      const isProtected =
        path.startsWith('/command') ||
        path.startsWith('/empire') ||
        path.startsWith('/operations') ||
        path.startsWith('/underworld') ||
        path.startsWith('/social') ||
        path.startsWith('/scout') ||
        path.startsWith('/produce') ||
        path.startsWith('/shop') ||
        path.startsWith('/attack') ||
        path.startsWith('/reports') ||
        path.startsWith('/rankings') ||
        path.startsWith('/players') ||
        path.startsWith('/guides') ||
        path.startsWith('/coming');

      if (isAuthPage) return true;
      if (isProtected) return isLoggedIn;
      return true;
    },
  },
  trustHost: true,
});
