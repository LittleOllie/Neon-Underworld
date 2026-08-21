import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { authConfig } from './auth.config';
import {
  OAuthAuthError,
  isGoogleOAuthConfigured,
  resolveGoogleAuthUser,
  validateGoogleSignIn,
} from './google-oauth';
import { authErrorCodeFromOAuthError } from './oauth-errors';

const googleProvider = Google({
  clientId: process.env.AUTH_GOOGLE_ID,
  clientSecret: process.env.AUTH_GOOGLE_SECRET,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(isGoogleOAuthConfigured() ? [googleProvider] : []),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const { authorizeCredentials } = await import('./authorize');
        return authorizeCredentials(credentials);
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;

      try {
        const email = profile?.email;
        const emailVerified = profile?.email_verified === true;
        const providerAccountId = account.providerAccountId;
        if (!email || !providerAccountId) {
          return '/login?authError=oauth_failed';
        }

        await validateGoogleSignIn({
          email,
          emailVerified,
          providerAccountId,
        });
        return true;
      } catch (error) {
        const code =
          error instanceof OAuthAuthError ? error.code : authErrorCodeFromOAuthError(error);
        return `/login?authError=${encodeURIComponent(code)}`;
      }
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === 'google') {
        const email = profile?.email;
        const emailVerified = profile?.email_verified === true;
        const providerAccountId = account.providerAccountId;
        if (!email || !providerAccountId) return token;

        try {
          const resolved = await resolveGoogleAuthUser({
            email,
            emailVerified,
            providerAccountId,
          });
          token.sub = resolved.id;
          token.role = resolved.role;
          token.playerId = resolved.playerId;
          token.alias = resolved.alias;
        } catch {
          return token;
        }
        return token;
      }

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
  },
});
